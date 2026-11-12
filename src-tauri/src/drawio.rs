use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use flate2::read::DeflateDecoder;
use percent_encoding::percent_decode_str;
use quick_xml::{
    XmlVersion,
    escape::unescape,
    events::{BytesStart, Event},
    reader::Reader,
};
use serde::{
    Deserialize, Deserializer, Serialize,
    de::{self, DeserializeSeed, MapAccess, SeqAccess, Visitor},
};
use serde_json::Value;
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    fmt,
    io::Read,
    ops::Range,
};
use uuid::{Uuid, Version};

pub const MAX_DRAWIO_BYTES: usize = 10 * 1024 * 1024;
const MAX_TOTAL_XML_BYTES: usize = 10 * 1024 * 1024;
const MAX_INFLATE_RATIO: usize = 100;
const MAX_XML_ELEMENTS: usize = 250_000;
const MAX_XML_DEPTH: usize = 64;
const MAX_PAGES: usize = 100;
const MAX_ELEMENTS: usize = 100_000;
const MAX_STYLES: usize = 10_000;
const MAX_SOURCE_ID_MAPPINGS: usize = 100_000;
const MAX_PRESERVED_FRAGMENTS: usize = 1_000;
const MAX_PRESERVED_FRAGMENT_BYTES: usize = 64 * 1024;
const MAX_PRESERVED_TOTAL_BYTES: usize = 1024 * 1024;
const MAX_REPORT_ITEMS: usize = 100;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawioImportCandidate {
    pub document: Value,
    pub losses: Vec<String>,
    pub preserved_fragment_count: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DrawioExportCandidate {
    pub xml: String,
    pub losses: Vec<String>,
    pub preserved_fragment_count: usize,
}

#[derive(Debug, Clone)]
struct XmlElement {
    name: String,
    attributes: BTreeMap<String, String>,
    children: Vec<XmlElement>,
    text: String,
    range: Range<usize>,
}

fn invalid_xml() -> String {
    "The draw.io file is malformed or uses unsupported XML.".into()
}

fn valid_xml_character(character: char) -> bool {
    let codepoint = character as u32;
    matches!(codepoint, 0x9 | 0xA | 0xD)
        || (0x20..=0xD7FF).contains(&codepoint)
        || (0xE000..=0xFFFD).contains(&codepoint)
        || (0x10000..=0x10FFFF).contains(&codepoint)
}

fn valid_xml_string(value: &str) -> bool {
    value.chars().all(valid_xml_character)
}

fn xml_attribute_value(start: &BytesStart<'_>) -> Result<BTreeMap<String, String>, String> {
    let mut attributes = BTreeMap::new();
    for attribute in start.attributes().with_checks(true) {
        let attribute = attribute.map_err(|_| invalid_xml())?;
        let name = attribute.key.as_ref().to_owned();
        let value = attribute
            .normalized_value(XmlVersion::Implicit1_0)
            .map_err(|_| invalid_xml())?
            .into_owned();
        if !valid_xml_string(&value) {
            return Err(invalid_xml());
        }
        if attributes.insert(name, value).is_some() {
            return Err(invalid_xml());
        }
    }
    Ok(attributes)
}

fn element_from_start(start: &BytesStart<'_>, range: Range<usize>) -> Result<XmlElement, String> {
    Ok(XmlElement {
        name: start.name().as_ref().to_owned(),
        attributes: xml_attribute_value(start)?,
        children: Vec::new(),
        text: String::new(),
        range,
    })
}

fn append_element(
    element: XmlElement,
    stack: &mut [XmlElement],
    root: &mut Option<XmlElement>,
) -> Result<(), String> {
    if let Some(parent) = stack.last_mut() {
        parent.children.push(element);
    } else if root.replace(element).is_some() {
        return Err(invalid_xml());
    }
    Ok(())
}

fn decode_reference(reference: &str) -> Result<String, String> {
    let value = unescape(&format!("&{reference};"))
        .map(|value| value.into_owned())
        .map_err(|_| "The draw.io file contains an undeclared entity.".to_string())?;
    if !valid_xml_string(&value) {
        return Err(invalid_xml());
    }
    Ok(value)
}

fn parse_xml_tree(source: &str, element_count: &mut usize) -> Result<XmlElement, String> {
    if !valid_xml_string(source) {
        return Err(invalid_xml());
    }
    let mut reader = Reader::from_str(source);
    reader.config_mut().check_end_names = true;
    reader.config_mut().allow_unmatched_ends = false;
    reader.config_mut().trim_text_start = false;
    reader.config_mut().trim_text_end = false;
    let mut stack = Vec::new();
    let mut root = None;

    loop {
        let start = reader.buffer_position() as usize;
        let event = reader.read_event().map_err(|_| invalid_xml())?;
        let end = reader.buffer_position() as usize;
        match event {
            Event::Start(tag) => {
                *element_count += 1;
                if *element_count > MAX_XML_ELEMENTS || stack.len() >= MAX_XML_DEPTH {
                    return Err("The draw.io XML exceeds parser resource limits.".into());
                }
                stack.push(element_from_start(&tag, start..end)?);
            }
            Event::Empty(tag) => {
                *element_count += 1;
                if *element_count > MAX_XML_ELEMENTS || stack.len() >= MAX_XML_DEPTH {
                    return Err("The draw.io XML exceeds parser resource limits.".into());
                }
                append_element(element_from_start(&tag, start..end)?, &mut stack, &mut root)?;
            }
            Event::End(_) => {
                let mut element = stack.pop().ok_or_else(invalid_xml)?;
                element.range.end = end;
                append_element(element, &mut stack, &mut root)?;
            }
            Event::Text(text) => {
                let value = text.xml_content(XmlVersion::Implicit1_0);
                if !valid_xml_string(&value) {
                    return Err(invalid_xml());
                }
                if let Some(parent) = stack.last_mut() {
                    parent.text.push_str(&value);
                } else if !value.trim().is_empty() {
                    return Err(invalid_xml());
                }
            }
            Event::CData(text) => {
                let value = text.xml_content(XmlVersion::Implicit1_0);
                if !valid_xml_string(&value) {
                    return Err(invalid_xml());
                }
                if let Some(parent) = stack.last_mut() {
                    parent.text.push_str(&value);
                } else if !value.trim().is_empty() {
                    return Err(invalid_xml());
                }
            }
            Event::GeneralRef(reference) => {
                let value = decode_reference(reference.as_ref())?;
                if let Some(parent) = stack.last_mut() {
                    parent.text.push_str(&value);
                } else if !value.trim().is_empty() {
                    return Err(invalid_xml());
                }
            }
            Event::Decl(declaration) => {
                if let Some(encoding) = declaration.encoding() {
                    let encoding = encoding.map_err(|_| invalid_xml())?;
                    if !encoding.eq_ignore_ascii_case("utf-8")
                        && !encoding.eq_ignore_ascii_case("utf8")
                    {
                        return Err("Only UTF-8 draw.io XML is supported.".into());
                    }
                }
            }
            Event::DocType(_) => {
                return Err("DTD and entity declarations are not supported.".into());
            }
            Event::PI(_) => {
                return Err("XML processing instructions are not supported.".into());
            }
            Event::Comment(_) => {}
            Event::Eof => break,
        }
    }

    if !stack.is_empty() {
        return Err(invalid_xml());
    }
    root.ok_or_else(invalid_xml)
}

fn attr<'a>(element: &'a XmlElement, key: &str) -> Option<&'a str> {
    element.attributes.get(key).map(String::as_str)
}

fn xml_safe_identifier(value: &str) -> bool {
    !value.is_empty() && value.len() <= 256 && !value.chars().any(|c| c.is_control())
}

fn is_external_reference(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    lower.contains("javascript:")
        || lower.contains("https:")
        || lower.contains("http:")
        || lower.contains("file:")
        || lower.contains("url(")
        || lower.contains("data:")
}

fn is_html_element(name: &str) -> bool {
    matches!(
        name,
        "a" | "abbr"
            | "address"
            | "article"
            | "aside"
            | "audio"
            | "b"
            | "base"
            | "blockquote"
            | "body"
            | "br"
            | "button"
            | "canvas"
            | "caption"
            | "code"
            | "col"
            | "dd"
            | "details"
            | "div"
            | "dl"
            | "dt"
            | "em"
            | "embed"
            | "fieldset"
            | "figcaption"
            | "figure"
            | "footer"
            | "form"
            | "h1"
            | "h2"
            | "h3"
            | "h4"
            | "h5"
            | "h6"
            | "head"
            | "header"
            | "hr"
            | "html"
            | "i"
            | "iframe"
            | "img"
            | "input"
            | "label"
            | "legend"
            | "li"
            | "link"
            | "main"
            | "meta"
            | "nav"
            | "object"
            | "ol"
            | "option"
            | "p"
            | "param"
            | "pre"
            | "script"
            | "section"
            | "select"
            | "source"
            | "span"
            | "strong"
            | "style"
            | "sub"
            | "summary"
            | "sup"
            | "svg"
            | "table"
            | "tbody"
            | "td"
            | "textarea"
            | "tfoot"
            | "th"
            | "thead"
            | "tr"
            | "track"
            | "u"
            | "ul"
            | "video"
            | "foreignobject"
    )
}

fn contains_markup(value: &str) -> bool {
    let bytes = value.as_bytes();
    let mut start = 0;
    while let Some(offset) = value[start..].find('<') {
        let opening = start + offset + 1;
        let name_start = opening + usize::from(bytes.get(opening) == Some(&b'/'));
        let mut end = name_start;
        while bytes.get(end).is_some_and(u8::is_ascii_alphanumeric)
            || bytes
                .get(end)
                .is_some_and(|byte| matches!(byte, b'-' | b'_' | b':'))
        {
            end += 1;
        }
        if end > name_start
            && bytes
                .get(end)
                .is_some_and(|byte| byte.is_ascii_whitespace() || matches!(byte, b'/' | b'>'))
        {
            return true;
        }
        start = opening;
    }
    false
}

fn check_active_content(element: &XmlElement) -> Result<(), String> {
    let name = element.name.to_ascii_lowercase();
    if name.contains(':') {
        return Err("Namespaced draw.io XML is not supported.".into());
    }
    if is_html_element(&name) || name == "image" {
        return Err("The draw.io file contains active or unsupported embedded content.".into());
    }
    for (name, value) in &element.attributes {
        let lower_name = name.to_ascii_lowercase();
        if lower_name == "xmlns" || lower_name.starts_with("xmlns:") || lower_name.contains(':') {
            return Err("Namespaced draw.io XML is not supported.".into());
        }
        if lower_name.starts_with("on")
            || [
                "href",
                "xlink:href",
                "src",
                "srcset",
                "action",
                "data",
                "link",
                "image",
            ]
            .contains(&lower_name.as_str())
        {
            return Err(
                "The draw.io file contains an active attribute or external reference.".into(),
            );
        }
        if lower_name == "style" && is_external_reference(value) {
            return Err("The draw.io file contains an external or active style reference.".into());
        }
        if lower_name == "style"
            && value
                .split(';')
                .filter_map(|token| token.split_once('='))
                .any(|(key, _)| ["image", "link", "fontSource"].contains(&key.trim()))
        {
            return Err("The draw.io file contains an active or external style feature.".into());
        }
        if lower_name == "value" && contains_markup(value) {
            return Err("The draw.io file contains active label content.".into());
        }
    }
    if contains_markup(&element.text) || has_dangerous_value(&element.text) {
        return Err("The draw.io file contains unsupported embedded label content.".into());
    }
    for child in &element.children {
        check_active_content(child)?;
    }
    Ok(())
}

fn compressed_page(text: &str, total_decoded_bytes: &mut usize) -> Result<String, String> {
    let compact: String = text
        .chars()
        .filter(|character| !character.is_ascii_whitespace())
        .collect();
    if compact.is_empty() || compact.len() > MAX_DRAWIO_BYTES {
        return Err("The compressed draw.io page is empty or too large.".into());
    }
    let compressed = BASE64
        .decode(compact.as_bytes())
        .map_err(|_| "The compressed draw.io page has invalid Base64.".to_string())?;
    if compressed.is_empty() {
        return Err("The compressed draw.io page is empty.".into());
    }
    let mut decoded = Vec::new();
    let mut decoder = DeflateDecoder::new(compressed.as_slice());
    decoder
        .by_ref()
        .take((MAX_DRAWIO_BYTES + 1) as u64)
        .read_to_end(&mut decoded)
        .map_err(|_| "The compressed draw.io page cannot be decoded.".to_string())?;
    if decoded.len() > MAX_DRAWIO_BYTES
        || decoded.len() > compressed.len().saturating_mul(MAX_INFLATE_RATIO)
        || decoder.total_in() as usize != compressed.len()
    {
        return Err(
            "The compressed draw.io page exceeds decompression limits or has trailing data.".into(),
        );
    }
    if decoded.iter().any(|byte| !byte.is_ascii()) {
        return Err("The compressed draw.io page has invalid URI encoding.".into());
    }
    let encoded = std::str::from_utf8(&decoded).map_err(|_| invalid_xml())?;
    let bytes = encoded.as_bytes();
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len()
                || !bytes[index + 1].is_ascii_hexdigit()
                || !bytes[index + 2].is_ascii_hexdigit()
            {
                return Err("The compressed draw.io page has invalid URI escapes.".into());
            }
            index += 3;
        } else {
            index += 1;
        }
    }
    let xml = percent_decode_str(encoded)
        .decode_utf8()
        .map_err(|_| "The compressed draw.io page is not valid UTF-8.".to_string())?
        .into_owned();
    *total_decoded_bytes = total_decoded_bytes.saturating_add(xml.len());
    if *total_decoded_bytes > MAX_TOTAL_XML_BYTES {
        return Err("The draw.io document exceeds the 10 MiB decoded XML limit.".into());
    }
    Ok(xml)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Document {
    schema_version: u8,
    document_id: String,
    metadata: Metadata,
    pages: Vec<Page>,
    styles: Vec<Style>,
    library_references: Vec<Value>,
    source_compatibility: Option<SourceCompatibility>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Metadata {
    title: String,
    description: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Page {
    page_id: String,
    name: String,
    layers: Vec<Layer>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Layer {
    layer_id: String,
    name: String,
    nodes: Vec<Node>,
    connections: Vec<Connection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Node {
    node_id: String,
    #[serde(rename = "type")]
    node_type: String,
    geometry: Geometry,
    text: String,
    style_id: Option<String>,
    catalog_reference: Option<CatalogReference>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Geometry {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    rotation: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Connection {
    connection_id: String,
    source_node_id: String,
    target_node_id: String,
    routing: String,
    label: String,
    style_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Style {
    style_id: String,
    fill: Option<String>,
    stroke: Option<String>,
    stroke_width: f64,
    text_color: String,
    font_size: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct CatalogReference {
    shape_id: String,
    version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceCompatibility {
    format: String,
    version: u8,
    pages: Vec<SourcePage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourcePage {
    page_id: String,
    source_page_id: String,
    cell_id_map: Vec<SourceCellMapping>,
    fragments: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct SourceCellMapping {
    source_id: String,
    element_id: String,
}

#[derive(Debug)]
struct ParsedStyle {
    shape_type: String,
    fill: Option<String>,
    stroke: Option<String>,
    stroke_width: f64,
    text_color: String,
    font_size: f64,
    rotation: f64,
}

struct PageOutput {
    page: Page,
    source_page: SourcePage,
    losses: Vec<String>,
}

fn push_loss(losses: &mut Vec<String>, message: impl Into<String>) {
    let message = message.into();
    if losses.iter().any(|loss| loss == &message) {
        return;
    }
    if losses.len() < MAX_REPORT_ITEMS {
        losses.push(message);
    } else if losses.len() == MAX_REPORT_ITEMS {
        losses.push("Additional unsupported features are omitted from this report.".into());
    }
}

fn has_dangerous_value(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();
    [
        "<script",
        "<iframe",
        "<object",
        "<embed",
        "<svg",
        "javascript:",
        "url(",
    ]
    .iter()
    .any(|needle| lower.contains(needle))
}

fn check_fragment_safety(element: &XmlElement) -> Result<(), String> {
    check_active_content(element)?;
    if element.name != "mxCell" {
        return Err("Only mxCell source fragments can be preserved.".into());
    }
    for (name, value) in &element.attributes {
        if name == "style" {
            for part in value.split(';') {
                if part.split_once('=').is_some_and(|(key, style_value)| {
                    ["image", "link", "fontSource"].contains(&key.trim())
                        || is_external_reference(style_value)
                }) {
                    return Err(
                        "The source cell contains an external or active style reference.".into(),
                    );
                }
            }
        }
        if name == "value" && has_dangerous_value(value) {
            return Err("The source cell contains active label content.".into());
        }
    }
    Ok(())
}

fn parse_style(style: &str, is_edge: bool, text: &str) -> Option<ParsedStyle> {
    let mut values = BTreeMap::<String, String>::new();
    let mut named_shape: Option<String> = None;
    for token in style.split(';').filter(|token| !token.is_empty()) {
        if let Some((key, value)) = token.split_once('=') {
            let key = key.trim().to_owned();
            if values.insert(key, value.trim().to_owned()).is_some() {
                return None;
            }
        } else if !is_edge && ["text", "rectangle", "rect"].contains(&token) {
            if named_shape.replace(token.to_owned()).is_some() {
                return None;
            }
        } else {
            return None;
        }
    }

    let shape_type = if is_edge {
        "edge".to_owned()
    } else {
        let shape = values.get("shape").or(named_shape.as_ref());
        match shape.map(String::as_str) {
            Some("text") => "text".to_owned(),
            None | Some("rectangle") | Some("rect") => "rectangle".to_owned(),
            _ => return None,
        }
    };
    let allowed: &[&str] = if is_edge {
        &[
            "edgeStyle",
            "endArrow",
            "startArrow",
            "html",
            "strokeColor",
            "strokeWidth",
            "fontColor",
            "fontSize",
        ]
    } else {
        &[
            "shape",
            "rounded",
            "whiteSpace",
            "html",
            "fillColor",
            "strokeColor",
            "strokeWidth",
            "fontColor",
            "fontSize",
            "rotation",
        ]
    };
    if values.keys().any(|key| !allowed.contains(&key.as_str())) {
        // Unsupported appearance is kept as an inert source fragment.
        return None;
    }
    if is_edge {
        if values.get("edgeStyle").is_some_and(|value| value != "none")
            || values.get("endArrow").is_none_or(|value| value != "none")
            || values
                .get("startArrow")
                .is_some_and(|value| value != "none")
        {
            return None;
        }
    } else if values.get("rounded").is_some_and(|value| value != "0")
        || values
            .get("whiteSpace")
            .is_some_and(|value| value != "wrap")
    {
        return None;
    }
    if values
        .get("html")
        .is_some_and(|value| value != "0" && value != "1")
    {
        return None;
    }
    if contains_markup(text) {
        return None;
    }

    let is_text = shape_type == "text";
    if is_text
        && ["fillColor", "strokeColor"].iter().any(|key| {
            values
                .get(*key)
                .is_some_and(|value| value != "none" && value != "default")
        })
    {
        return None;
    }
    let color = |key: &str, default: &str| -> Option<Option<String>> {
        match values.get(key).map(String::as_str) {
            None | Some("default") => Some(Some(default.to_owned())),
            Some("none") => Some(None),
            Some(value) if is_hex_color(value) => Some(Some(value.to_ascii_lowercase())),
            _ => None,
        }
    };
    let fill = if is_edge || is_text {
        None
    } else {
        color("fillColor", "#ffffff")?
    };
    let stroke = if is_edge {
        color("strokeColor", "#000000")?
    } else if is_text {
        None
    } else {
        color("strokeColor", "#000000")?
    };
    let text_color = color("fontColor", "#000000")?.unwrap_or_else(|| "#000000".into());
    let stroke_width = parse_number(values.get("strokeWidth").map(String::as_str).unwrap_or("1"))?;
    let font_size = parse_number(values.get("fontSize").map(String::as_str).unwrap_or("12"))?;
    let rotation = if is_edge {
        0.0
    } else {
        parse_number(values.get("rotation").map(String::as_str).unwrap_or("0"))?
    };
    if !(0.0..=1000.0).contains(&stroke_width)
        || !(1.0..=1000.0).contains(&font_size)
        || !(0.0..360.0).contains(&rotation)
    {
        return None;
    }
    Some(ParsedStyle {
        shape_type,
        fill,
        stroke,
        stroke_width,
        text_color,
        font_size,
        rotation,
    })
}

fn is_hex_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

fn parse_number(value: &str) -> Option<f64> {
    let number = value.parse::<f64>().ok()?;
    number
        .is_finite()
        .then_some(if number == 0.0 { 0.0 } else { number })
}

fn checked_geometry(element: &XmlElement, rotation: f64) -> Option<Geometry> {
    if attr(element, "as") != Some("geometry") || !element.children.is_empty() {
        return None;
    }
    let x = parse_number(attr(element, "x")?)?;
    let y = parse_number(attr(element, "y")?)?;
    let width = parse_number(attr(element, "width")?)?;
    let height = parse_number(attr(element, "height")?)?;
    if !(-1_000_000.0..=1_000_000.0).contains(&x)
        || !(-1_000_000.0..=1_000_000.0).contains(&y)
        || !(0.0..=1_000_000.0).contains(&width)
        || width == 0.0
        || !(0.0..=1_000_000.0).contains(&height)
        || height == 0.0
        || !(0.0..360.0).contains(&rotation)
    {
        return None;
    }
    Some(Geometry {
        x,
        y,
        width,
        height,
        rotation,
    })
}

fn push_bounded_fragment(
    element: &XmlElement,
    source: &str,
    fragments: &mut Vec<String>,
    total_bytes: &mut usize,
) -> Result<(), String> {
    check_fragment_safety(element)?;
    let raw = source
        .get(element.range.clone())
        .ok_or_else(invalid_xml)?
        .to_owned();
    let length = raw.len();
    if length == 0 || length > MAX_PRESERVED_FRAGMENT_BYTES {
        return Err("A safe source fragment exceeds the 64 KiB preservation limit.".into());
    }
    if fragments.len() >= MAX_PRESERVED_FRAGMENTS {
        return Err("The draw.io file exceeds the 1,000-fragment preservation limit.".into());
    }
    *total_bytes = total_bytes.saturating_add(length);
    if *total_bytes > MAX_PRESERVED_TOTAL_BYTES {
        return Err("The draw.io file exceeds the 1 MiB source-preservation limit.".into());
    }
    fragments.push(raw);
    Ok(())
}

fn is_vertex(cell: &XmlElement) -> bool {
    attr(cell, "vertex") == Some("1") && attr(cell, "edge") != Some("1")
}

fn is_edge(cell: &XmlElement) -> bool {
    attr(cell, "edge") == Some("1") && attr(cell, "vertex") != Some("1")
}

fn supported_cell_attributes(cell: &XmlElement, is_edge: bool) -> bool {
    let allowed: &[&str] = if is_edge {
        &["id", "value", "style", "edge", "parent", "source", "target"]
    } else {
        &["id", "value", "style", "vertex", "parent"]
    };
    cell.attributes
        .keys()
        .all(|name| allowed.contains(&name.as_str()))
}

fn source_cell_id(cell: &XmlElement) -> Result<String, String> {
    let id = attr(cell, "id").ok_or_else(invalid_xml)?;
    if !xml_safe_identifier(id) {
        return Err("A draw.io cell identifier is invalid or too large.".into());
    }
    Ok(id.to_owned())
}

fn cell_geometry(cell: &XmlElement) -> Option<&XmlElement> {
    let mut geometries = cell
        .children
        .iter()
        .filter(|child| child.name == "mxGeometry");
    let geometry = geometries.next()?;
    geometries.next().is_none().then_some(geometry)
}

fn make_style(style: &ParsedStyle, style_id: String) -> Style {
    Style {
        style_id,
        fill: style.fill.clone(),
        stroke: style.stroke.clone(),
        stroke_width: style.stroke_width,
        text_color: style.text_color.clone(),
        font_size: style.font_size,
    }
}

fn style_id_for(
    style: &ParsedStyle,
    styles: &mut Vec<Style>,
    style_cache: &mut HashMap<String, String>,
) -> Result<String, String> {
    let key = format!(
        "{}|{}|{}|{}|{}",
        style.fill.as_deref().unwrap_or("none"),
        style.stroke.as_deref().unwrap_or("none"),
        style.stroke_width,
        style.text_color,
        style.font_size
    );
    if let Some(existing) = style_cache.get(&key) {
        return Ok(existing.clone());
    }
    if styles.len() >= MAX_STYLES {
        return Err("The draw.io document exceeds the 10,000-style limit.".into());
    }
    let id = Uuid::new_v4().to_string();
    styles.push(make_style(style, id.clone()));
    style_cache.insert(key, id.clone());
    Ok(id)
}

fn parse_vertex(
    cell: &XmlElement,
    styles: &mut Vec<Style>,
    style_cache: &mut HashMap<String, String>,
) -> Result<Option<(String, Node)>, String> {
    if !is_vertex(cell)
        || attr(cell, "parent") != Some("1")
        || !supported_cell_attributes(cell, false)
        || !cell.text.trim().is_empty()
    {
        return Ok(None);
    }
    let source_id = source_cell_id(cell)?;
    if cell.children.len() != 1 || cell.children[0].name != "mxGeometry" {
        return Ok(None);
    }
    let geometry = match cell_geometry(cell).and_then(|geometry| {
        if !geometry.children.is_empty()
            || !geometry.text.trim().is_empty()
            || attr(geometry, "as") != Some("geometry")
            || geometry
                .attributes
                .keys()
                .any(|key| !["as", "x", "y", "width", "height"].contains(&key.as_str()))
        {
            return None;
        }
        let style = parse_style(
            attr(cell, "style").unwrap_or(""),
            false,
            attr(cell, "value").unwrap_or(""),
        )?;
        checked_geometry(geometry, style.rotation).map(|geometry| (geometry, style))
    }) {
        Some(geometry) => geometry,
        None => return Ok(None),
    };
    let (geometry, parsed_style) = geometry;
    let id = style_id_for(&parsed_style, styles, style_cache)?;
    let node = Node {
        node_id: Uuid::new_v4().to_string(),
        node_type: parsed_style.shape_type,
        geometry,
        text: attr(cell, "value").unwrap_or("").to_owned(),
        style_id: Some(id),
        catalog_reference: None,
    };
    Ok(Some((source_id, node)))
}

fn parse_connection(
    cell: &XmlElement,
    nodes: &HashMap<String, Node>,
    styles: &mut Vec<Style>,
    style_cache: &mut HashMap<String, String>,
) -> Result<Option<(String, Connection)>, String> {
    if !is_edge(cell)
        || attr(cell, "parent") != Some("1")
        || !supported_cell_attributes(cell, true)
        || !cell.text.trim().is_empty()
    {
        return Ok(None);
    }
    let source_id = source_cell_id(cell)?;
    let source = match attr(cell, "source").and_then(|id| nodes.get(id)) {
        Some(node) => node.node_id.clone(),
        None => return Ok(None),
    };
    let target = match attr(cell, "target").and_then(|id| nodes.get(id)) {
        Some(node) => node.node_id.clone(),
        None => return Ok(None),
    };
    let geometry = match cell_geometry(cell) {
        Some(geometry)
            if cell.children.len() == 1
                && cell.children[0].name == "mxGeometry"
                && geometry.text.trim().is_empty()
                && attr(geometry, "as") == Some("geometry")
                && attr(geometry, "relative") == Some("1")
                && geometry.children.is_empty()
                && geometry
                    .attributes
                    .keys()
                    .all(|key| ["as", "relative"].contains(&key.as_str())) =>
        {
            geometry
        }
        _ => return Ok(None),
    };
    let _ = geometry;
    let parsed_style = match parse_style(
        attr(cell, "style").unwrap_or(""),
        true,
        attr(cell, "value").unwrap_or(""),
    ) {
        Some(style) => style,
        None => return Ok(None),
    };
    let style_id = style_id_for(&parsed_style, styles, style_cache)?;
    Ok(Some((
        source_id.clone(),
        Connection {
            connection_id: Uuid::new_v4().to_string(),
            source_node_id: source,
            target_node_id: target,
            routing: "straight".into(),
            label: attr(cell, "value").unwrap_or("").to_owned(),
            style_id: Some(style_id),
        },
    )))
}

#[allow(clippy::too_many_arguments)] // Explicit counters keep resource limits visible at each parse boundary.
fn parse_graph_page(
    graph: &XmlElement,
    source: &str,
    page_id: String,
    source_page_id: String,
    page_name: String,
    total_fragment_bytes: &mut usize,
    style_cache: &mut HashMap<String, String>,
    styles: &mut Vec<Style>,
    total_elements: &mut usize,
) -> Result<PageOutput, String> {
    let roots = graph
        .children
        .iter()
        .filter(|child| child.name == "root")
        .collect::<Vec<_>>();
    if roots.len() != 1 {
        return Err(invalid_xml());
    }
    let root = roots[0];
    let cells = root
        .children
        .iter()
        .filter(|child| child.name == "mxCell")
        .collect::<Vec<_>>();
    let mut ids = HashSet::new();
    for cell in &cells {
        let id = source_cell_id(cell)?;
        if !ids.insert(id) {
            return Err("The draw.io page contains duplicate cell IDs.".into());
        }
    }
    if !cells.iter().any(|cell| attr(cell, "id") == Some("0")) {
        return Err("The draw.io page has no root cell.".into());
    }

    let mut losses = Vec::new();
    for name in graph.attributes.keys() {
        if name != "dx" && name != "dy" {
            push_loss(&mut losses, format!("mxGraphModel.{name}"));
        }
    }
    if !graph.text.trim().is_empty() {
        push_loss(
            &mut losses,
            "Text directly inside mxGraphModel was not imported.",
        );
    }
    if graph.children.iter().any(|child| child.name != "root") {
        push_loss(
            &mut losses,
            "Unsupported XML outside the graph root was not imported.",
        );
    }
    if !root.text.trim().is_empty() {
        push_loss(
            &mut losses,
            "Text directly inside the graph root was not imported.",
        );
    }
    if !root.attributes.is_empty() {
        push_loss(
            &mut losses,
            "Attributes on the graph root were not imported.",
        );
    }
    for child in &root.children {
        if child.name != "mxCell" {
            push_loss(
                &mut losses,
                "Unsupported XML inside the graph root was not imported.",
            );
        }
    }

    let default_layer = cells.iter().find(|cell| attr(cell, "id") == Some("1"));
    if default_layer.is_none() || default_layer.and_then(|cell| attr(cell, "parent")) != Some("0") {
        return Err("The draw.io page has no default layer cell.".into());
    }
    if let Some(root_cell) = cells.iter().find(|cell| attr(cell, "id") == Some("0"))
        && (root_cell.attributes.keys().any(|name| name != "id")
            || !root_cell.children.is_empty()
            || !root_cell.text.trim().is_empty())
    {
        push_loss(
            &mut losses,
            "Unsupported attributes or children on draw.io root cell were not imported.",
        );
    }
    if let Some(layer_cell) = default_layer
        && (layer_cell
            .attributes
            .keys()
            .any(|name| !["id", "parent", "value"].contains(&name.as_str()))
            || !layer_cell.children.is_empty()
            || !layer_cell.text.trim().is_empty())
    {
        push_loss(
            &mut losses,
            "Unsupported attributes or children on the default draw.io layer were not imported.",
        );
    }
    let layer_name = default_layer
        .and_then(|cell| attr(cell, "value"))
        .filter(|name| !name.is_empty())
        .unwrap_or("Layer 1")
        .to_owned();
    let layer_id = Uuid::new_v4().to_string();
    let mut source_id_map = vec![SourceCellMapping {
        source_id: default_layer
            .and_then(|cell| attr(cell, "id"))
            .unwrap_or("1")
            .to_owned(),
        element_id: layer_id.clone(),
    }];
    let mut nodes = Vec::new();
    let mut mapped_nodes = HashMap::new();
    let mut mapped_source_ids = HashSet::new();

    for cell in &cells {
        if attr(cell, "id") == Some("0") || attr(cell, "id") == Some("1") {
            continue;
        }
        if let Some((source_id, node)) = parse_vertex(cell, styles, style_cache)? {
            mapped_source_ids.insert(source_id.clone());
            mapped_nodes.insert(source_id.clone(), node.clone());
            source_id_map.push(SourceCellMapping {
                source_id,
                element_id: node.node_id.clone(),
            });
            nodes.push(node);
        }
    }

    let mut connections = Vec::new();
    for cell in &cells {
        if attr(cell, "id") == Some("0") || attr(cell, "id") == Some("1") {
            continue;
        }
        if let Some((source_id, connection)) =
            parse_connection(cell, &mapped_nodes, styles, style_cache)?
        {
            mapped_source_ids.insert(source_id.clone());
            source_id_map.push(SourceCellMapping {
                source_id,
                element_id: connection.connection_id.clone(),
            });
            connections.push(connection);
        }
    }

    let mut fragments = Vec::new();
    for cell in &cells {
        let id = attr(cell, "id").unwrap_or_default();
        if id == "0" || id == "1" || mapped_source_ids.contains(id) {
            continue;
        }
        push_bounded_fragment(cell, source, &mut fragments, total_fragment_bytes)?;
    }

    *total_elements += nodes.len() + connections.len();
    if *total_elements > MAX_ELEMENTS {
        return Err("The draw.io document exceeds the 100,000-element limit.".into());
    }
    let source_page = SourcePage {
        page_id: page_id.clone(),
        source_page_id,
        cell_id_map: source_id_map,
        fragments,
    };
    Ok(PageOutput {
        page: Page {
            page_id,
            name: page_name,
            layers: vec![Layer {
                layer_id,
                name: layer_name,
                nodes,
                connections,
            }],
        },
        source_page,
        losses,
    })
}

fn parse_graph_source(source: &str, element_count: &mut usize) -> Result<XmlElement, String> {
    let graph = parse_xml_tree(source, element_count)?;
    if graph.name != "mxGraphModel" {
        return Err("A draw.io page does not contain an mxGraphModel root.".into());
    }
    check_active_content(&graph)?;
    Ok(graph)
}

#[allow(clippy::too_many_arguments)] // Explicit counters keep resource limits visible at each parse boundary.
fn parse_diagram_page(
    diagram: &XmlElement,
    source_document: &str,
    page_index: usize,
    element_count: &mut usize,
    total_decoded_bytes: &mut usize,
    total_fragment_bytes: &mut usize,
    total_elements: &mut usize,
    styles: &mut Vec<Style>,
    style_cache: &mut HashMap<String, String>,
) -> Result<PageOutput, String> {
    let page_name = attr(diagram, "name")
        .filter(|name| !name.trim().is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| format!("Page {}", page_index + 1));
    let invalid_source_page_id = attr(diagram, "id").is_some_and(|id| !xml_safe_identifier(id));
    let source_page_id = attr(diagram, "id")
        .filter(|id| xml_safe_identifier(id))
        .map(str::to_owned)
        .unwrap_or_else(|| format!("page-{}", page_index + 1));

    let (graph, graph_source) = match diagram
        .children
        .iter()
        .filter(|child| child.name == "mxGraphModel")
        .collect::<Vec<_>>()
        .as_slice()
    {
        [graph] => {
            if !diagram.text.trim().is_empty() {
                return Err(invalid_xml());
            }
            (
                (*graph).clone(),
                std::borrow::Cow::Borrowed(source_document),
            )
        }
        [] if !diagram.text.trim().is_empty() => {
            let decoded = compressed_page(&diagram.text, total_decoded_bytes)?;
            (
                parse_graph_source(&decoded, element_count)?,
                std::borrow::Cow::Owned(decoded),
            )
        }
        _ => return Err(invalid_xml()),
    };
    check_active_content(&graph)?;
    if page_name.chars().count() > 256 {
        return Err("A draw.io page name exceeds the 256-character limit.".into());
    }

    let mut page = parse_graph_page(
        &graph,
        &graph_source,
        Uuid::new_v4().to_string(),
        source_page_id,
        page_name,
        total_fragment_bytes,
        style_cache,
        styles,
        total_elements,
    )?;
    if invalid_source_page_id {
        push_loss(
            &mut page.losses,
            "An invalid source page ID was replaced with a generated ID.",
        );
    }
    Ok(page)
}

fn parse_bare_graph_page(
    graph: XmlElement,
    graph_source: &str,
    title: &str,
    total_fragment_bytes: &mut usize,
    total_elements: &mut usize,
    styles: &mut Vec<Style>,
    style_cache: &mut HashMap<String, String>,
) -> Result<PageOutput, String> {
    check_active_content(&graph)?;
    parse_graph_page(
        &graph,
        graph_source,
        Uuid::new_v4().to_string(),
        "page-1".into(),
        if title.trim().is_empty() {
            "Page 1".into()
        } else {
            title.into()
        },
        total_fragment_bytes,
        style_cache,
        styles,
        total_elements,
    )
}

fn valid_timestamp(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 24
        || bytes[4] != b'-'
        || bytes[7] != b'-'
        || bytes[10] != b'T'
        || bytes[13] != b':'
        || bytes[16] != b':'
        || bytes[19] != b'.'
        || bytes[23] != b'Z'
    {
        return false;
    }
    for (index, byte) in bytes.iter().enumerate() {
        if ![4, 7, 10, 13, 16, 19, 23].contains(&index) && !byte.is_ascii_digit() {
            return false;
        }
    }
    let number = |start: usize, end: usize| value[start..end].parse::<u32>().ok();
    let (Some(year), Some(month), Some(day), Some(hour), Some(minute), Some(second)) = (
        number(0, 4),
        number(5, 7),
        number(8, 10),
        number(11, 13),
        number(14, 16),
        number(17, 19),
    ) else {
        return false;
    };
    let days = match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if year % 400 == 0 || (year % 4 == 0 && year % 100 != 0) => 29,
        2 => 28,
        _ => return false,
    };
    (1..=days).contains(&day) && hour < 24 && minute < 60 && second < 60
}

pub fn parse_drawio_document(
    bytes: &[u8],
    title: &str,
    now: &str,
) -> Result<DrawioImportCandidate, String> {
    if bytes.is_empty() || bytes.len() > MAX_DRAWIO_BYTES {
        return Err("The draw.io file is empty or exceeds the 10 MiB input limit.".into());
    }
    if title.trim().is_empty() || title.chars().count() > 256 || !valid_timestamp(now) {
        return Err("The draw.io import metadata is invalid.".into());
    }
    let source = std::str::from_utf8(bytes)
        .map_err(|_| "Only UTF-8 draw.io files are supported.".to_string())?;
    let source = source.strip_prefix('\u{feff}').unwrap_or(source);
    let mut element_count = 0;
    let root = parse_xml_tree(source, &mut element_count)?;
    check_active_content(&root)?;

    let mut total_decoded_bytes = source.len();
    let mut total_fragment_bytes = 0;
    let mut total_elements = 0;
    let mut styles = Vec::new();
    let mut style_cache = HashMap::new();
    let mut output_pages = Vec::new();
    let mut source_pages = Vec::new();
    let mut losses = Vec::new();

    match root.name.as_str() {
        "mxGraphModel" => {
            let parsed = parse_bare_graph_page(
                root,
                source,
                title,
                &mut total_fragment_bytes,
                &mut total_elements,
                &mut styles,
                &mut style_cache,
            )?;
            output_pages.push(parsed.page);
            source_pages.push(parsed.source_page);
            losses.extend(parsed.losses);
        }
        "mxfile" => {
            for name in root.attributes.keys() {
                if ![
                    "host",
                    "type",
                    "compressed",
                    "version",
                    "agent",
                    "modified",
                    "etag",
                    "name",
                    "pages",
                    "bookmark",
                    "chromeless",
                ]
                .contains(&name.as_str())
                {
                    push_loss(&mut losses, format!("mxfile.{name}"));
                }
            }
            if !root.text.trim().is_empty() {
                push_loss(&mut losses, "Text directly inside mxfile was not imported.");
            }
            let diagrams = root
                .children
                .iter()
                .filter(|child| child.name == "diagram")
                .collect::<Vec<_>>();
            if diagrams.is_empty() || diagrams.len() > MAX_PAGES {
                return Err("The draw.io file must contain between 1 and 100 pages.".into());
            }
            for child in &root.children {
                if child.name != "diagram" {
                    push_loss(
                        &mut losses,
                        format!(
                            "Unsupported mxfile element <{}> was not imported.",
                            child.name
                        ),
                    );
                }
            }
            for (index, diagram) in diagrams.iter().enumerate() {
                let mut parsed = parse_diagram_page(
                    diagram,
                    source,
                    index,
                    &mut element_count,
                    &mut total_decoded_bytes,
                    &mut total_fragment_bytes,
                    &mut total_elements,
                    &mut styles,
                    &mut style_cache,
                )?;
                for name in diagram.attributes.keys() {
                    if name != "id" && name != "name" {
                        push_loss(&mut parsed.losses, format!("diagram.{name}"));
                    }
                }
                if diagram
                    .children
                    .iter()
                    .any(|child| child.name != "mxGraphModel")
                {
                    push_loss(
                        &mut parsed.losses,
                        "Unsupported XML inside a draw.io page was not imported.",
                    );
                }
                output_pages.push(parsed.page);
                source_pages.push(parsed.source_page);
                for loss in parsed.losses {
                    push_loss(&mut losses, loss);
                }
            }
        }
        _ => return Err("The draw.io file root must be <mxfile> or <mxGraphModel>.".into()),
    }

    let preserved_fragment_count = source_pages.iter().map(|page| page.fragments.len()).sum();
    let document = Document {
        schema_version: 2,
        document_id: Uuid::new_v4().to_string(),
        metadata: Metadata {
            title: title.to_owned(),
            description: String::new(),
            created_at: now.to_owned(),
            updated_at: now.to_owned(),
        },
        pages: output_pages,
        styles,
        library_references: Vec::new(),
        source_compatibility: Some(SourceCompatibility {
            format: "drawio".into(),
            version: 1,
            pages: source_pages,
        }),
    };
    validate_document(&document)?;
    let serialized = serde_json::to_vec(&document)
        .map_err(|_| "The draw.io document could not be mapped.".to_string())?;
    if serialized.len() > MAX_DRAWIO_BYTES {
        return Err("The imported PeerCanvas document exceeds the 10 MiB document limit.".into());
    }
    let document = serde_json::from_slice(&serialized)
        .map_err(|_| "The draw.io document could not be mapped.".to_string())?;
    Ok(DrawioImportCandidate {
        document,
        losses,
        preserved_fragment_count,
    })
}

struct UniqueJsonSeed;

impl<'de> DeserializeSeed<'de> for UniqueJsonSeed {
    type Value = Value;

    fn deserialize<D>(self, deserializer: D) -> Result<Self::Value, D::Error>
    where
        D: Deserializer<'de>,
    {
        deserializer.deserialize_any(UniqueJsonVisitor)
    }
}

struct UniqueJsonVisitor;

impl<'de> Visitor<'de> for UniqueJsonVisitor {
    type Value = Value;

    fn expecting(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("a JSON value with unique object keys")
    }

    fn visit_bool<E>(self, value: bool) -> Result<Value, E> {
        Ok(Value::Bool(value))
    }

    fn visit_i64<E>(self, value: i64) -> Result<Value, E> {
        Ok(Value::Number(value.into()))
    }

    fn visit_u64<E>(self, value: u64) -> Result<Value, E> {
        Ok(Value::Number(value.into()))
    }

    fn visit_f64<E>(self, value: f64) -> Result<Value, E>
    where
        E: de::Error,
    {
        serde_json::Number::from_f64(value)
            .map(Value::Number)
            .ok_or_else(|| E::custom("non-finite number"))
    }

    fn visit_str<E>(self, value: &str) -> Result<Value, E> {
        Ok(Value::String(value.to_owned()))
    }

    fn visit_string<E>(self, value: String) -> Result<Value, E> {
        Ok(Value::String(value))
    }

    fn visit_unit<E>(self) -> Result<Value, E> {
        Ok(Value::Null)
    }

    fn visit_none<E>(self) -> Result<Value, E> {
        Ok(Value::Null)
    }

    fn visit_seq<A>(self, mut sequence: A) -> Result<Value, A::Error>
    where
        A: SeqAccess<'de>,
    {
        let mut values = Vec::new();
        while let Some(value) = sequence.next_element_seed(UniqueJsonSeed)? {
            values.push(value);
        }
        Ok(Value::Array(values))
    }

    fn visit_map<A>(self, mut map: A) -> Result<Value, A::Error>
    where
        A: MapAccess<'de>,
    {
        let mut values = serde_json::Map::new();
        let mut seen = HashSet::new();
        while let Some(key) = map.next_key::<String>()? {
            if !seen.insert(key.clone()) {
                return Err(de::Error::custom("duplicate object key"));
            }
            let value = map.next_value_seed(UniqueJsonSeed)?;
            values.insert(key, value);
        }
        Ok(Value::Object(values))
    }
}

fn parse_unique_json(source: &str) -> Result<Value, String> {
    let mut deserializer = serde_json::Deserializer::from_str(source);
    let value = UniqueJsonSeed
        .deserialize(&mut deserializer)
        .map_err(|_| "The document JSON is invalid or contains duplicate keys.".to_string())?;
    deserializer
        .end()
        .map_err(|_| "The document JSON contains trailing data.".to_string())?;
    Ok(value)
}

fn exact_keys(value: &Value, keys: &[&str]) -> bool {
    value.as_object().is_some_and(|object| {
        object.len() == keys.len() && keys.iter().all(|key| object.contains_key(*key))
    })
}

fn document_shape_is_exact(value: &Value) -> bool {
    if !exact_keys(
        value,
        &[
            "schemaVersion",
            "documentId",
            "metadata",
            "pages",
            "styles",
            "libraryReferences",
            "sourceCompatibility",
        ],
    ) {
        return false;
    }
    let Some(metadata) = value.get("metadata") else {
        return false;
    };
    if !exact_keys(
        metadata,
        &["title", "description", "createdAt", "updatedAt"],
    ) {
        return false;
    }
    let Some(pages) = value.get("pages").and_then(Value::as_array) else {
        return false;
    };
    for page in pages {
        if !exact_keys(page, &["pageId", "name", "layers"]) {
            return false;
        }
        let Some(layers) = page.get("layers").and_then(Value::as_array) else {
            return false;
        };
        for layer in layers {
            if !exact_keys(layer, &["layerId", "name", "nodes", "connections"]) {
                return false;
            }
            let (Some(nodes), Some(connections)) = (
                layer.get("nodes").and_then(Value::as_array),
                layer.get("connections").and_then(Value::as_array),
            ) else {
                return false;
            };
            for node in nodes {
                if !exact_keys(
                    node,
                    &[
                        "nodeId",
                        "type",
                        "geometry",
                        "text",
                        "styleId",
                        "catalogReference",
                    ],
                ) {
                    return false;
                }
                let Some(geometry) = node.get("geometry") else {
                    return false;
                };
                if !exact_keys(geometry, &["x", "y", "width", "height", "rotation"]) {
                    return false;
                }
                if let Some(reference) = node
                    .get("catalogReference")
                    .filter(|value| !value.is_null())
                    && !exact_keys(reference, &["shapeId", "version"])
                {
                    return false;
                }
            }
            for connection in connections {
                if !exact_keys(
                    connection,
                    &[
                        "connectionId",
                        "sourceNodeId",
                        "targetNodeId",
                        "routing",
                        "label",
                        "styleId",
                    ],
                ) {
                    return false;
                }
            }
        }
    }
    let Some(styles) = value.get("styles").and_then(Value::as_array) else {
        return false;
    };
    for style in styles {
        if !exact_keys(
            style,
            &[
                "styleId",
                "fill",
                "stroke",
                "strokeWidth",
                "textColor",
                "fontSize",
            ],
        ) {
            return false;
        }
    }
    if let Some(compatibility) = value
        .get("sourceCompatibility")
        .filter(|value| !value.is_null())
    {
        if !exact_keys(compatibility, &["format", "version", "pages"]) {
            return false;
        }
        let Some(source_pages) = compatibility.get("pages").and_then(Value::as_array) else {
            return false;
        };
        for page in source_pages {
            if !exact_keys(page, &["pageId", "sourcePageId", "cellIdMap", "fragments"]) {
                return false;
            }
            let (Some(mappings), Some(fragments)) = (
                page.get("cellIdMap").and_then(Value::as_array),
                page.get("fragments").and_then(Value::as_array),
            ) else {
                return false;
            };
            if mappings
                .iter()
                .any(|mapping| !exact_keys(mapping, &["sourceId", "elementId"]))
                || fragments.iter().any(|fragment| !fragment.is_string())
            {
                return false;
            }
        }
    }
    true
}

fn valid_uuid_v4(value: &str) -> bool {
    Uuid::parse_str(value)
        .is_ok_and(|uuid| uuid.to_string() == value && uuid.get_version() == Some(Version::Random))
}

fn valid_name(value: &str) -> bool {
    !value.trim().is_empty() && value.chars().count() <= 256
}

fn valid_color(value: &str) -> bool {
    value.len() == 7
        && value.starts_with('#')
        && value == value.to_ascii_lowercase()
        && value.as_bytes()[1..].iter().all(u8::is_ascii_hexdigit)
}

fn validate_fragment(fragment: &str, xml_elements: &mut usize) -> Result<XmlElement, String> {
    if fragment.is_empty() || fragment.len() > MAX_PRESERVED_FRAGMENT_BYTES {
        return Err("A preserved draw.io fragment exceeds its size limit.".into());
    }
    let element = parse_xml_tree(fragment, xml_elements)?;
    check_fragment_safety(&element)?;
    Ok(element)
}

fn validate_document(document: &Document) -> Result<(), String> {
    if document.schema_version != 2
        || !valid_uuid_v4(&document.document_id)
        || !valid_name(&document.metadata.title)
        || document.metadata.description.chars().count() > 4096
        || !valid_timestamp(&document.metadata.created_at)
        || !valid_timestamp(&document.metadata.updated_at)
        || document.metadata.updated_at < document.metadata.created_at
        || document.pages.is_empty()
        || document.pages.len() > MAX_PAGES
        || document.styles.len() > MAX_STYLES
        || !document.library_references.is_empty()
    {
        return Err("The PeerCanvas document is invalid or exceeds supported limits.".into());
    }
    let mut all_ids = HashSet::new();
    if !all_ids.insert(document.document_id.as_str()) {
        return Err("The PeerCanvas document contains duplicate identifiers.".into());
    }
    let mut style_ids = HashSet::new();
    for style in &document.styles {
        if !valid_uuid_v4(&style.style_id)
            || !all_ids.insert(style.style_id.as_str())
            || !style_ids.insert(style.style_id.as_str())
            || style
                .fill
                .as_deref()
                .is_some_and(|color| !valid_color(color))
            || style
                .stroke
                .as_deref()
                .is_some_and(|color| !valid_color(color))
            || !valid_color(&style.text_color)
            || !style.stroke_width.is_finite()
            || !(0.0..=1000.0).contains(&style.stroke_width)
            || !style.font_size.is_finite()
            || !(1.0..=1000.0).contains(&style.font_size)
        {
            return Err("The PeerCanvas document contains an invalid style.".into());
        }
    }
    let mut element_count = 0usize;
    let mut total_elements = 0usize;
    let mut total_layers = 0usize;
    let mut page_ids = HashSet::new();
    let mut page_elements = HashMap::<&str, HashSet<&str>>::new();
    for page in &document.pages {
        if !valid_uuid_v4(&page.page_id)
            || !all_ids.insert(page.page_id.as_str())
            || !page_ids.insert(page.page_id.as_str())
            || !valid_name(&page.name)
            || page.layers.is_empty()
        {
            return Err("The PeerCanvas document contains an invalid page.".into());
        }
        let mut ids = HashSet::new();
        let page_node_ids = page
            .layers
            .iter()
            .flat_map(|layer| layer.nodes.iter().map(|node| node.node_id.as_str()))
            .collect::<HashSet<_>>();
        for layer in &page.layers {
            total_layers += 1;
            if !valid_uuid_v4(&layer.layer_id)
                || !all_ids.insert(layer.layer_id.as_str())
                || !valid_name(&layer.name)
            {
                return Err("The PeerCanvas document contains an invalid layer.".into());
            }
            ids.insert(layer.layer_id.as_str());
            for node in &layer.nodes {
                total_elements += 1;
                if !valid_uuid_v4(&node.node_id)
                    || !all_ids.insert(node.node_id.as_str())
                    || !ids.insert(node.node_id.as_str())
                    || !["rectangle", "text"].contains(&node.node_type.as_str())
                    || node.text.chars().count() > 100_000
                    || !node.geometry.x.is_finite()
                    || !(-1_000_000.0..=1_000_000.0).contains(&node.geometry.x)
                    || !node.geometry.y.is_finite()
                    || !(-1_000_000.0..=1_000_000.0).contains(&node.geometry.y)
                    || !node.geometry.width.is_finite()
                    || !(0.0..=1_000_000.0).contains(&node.geometry.width)
                    || node.geometry.width == 0.0
                    || !node.geometry.height.is_finite()
                    || !(0.0..=1_000_000.0).contains(&node.geometry.height)
                    || node.geometry.height == 0.0
                    || !node.geometry.rotation.is_finite()
                    || !(0.0..360.0).contains(&node.geometry.rotation)
                    || node
                        .style_id
                        .as_deref()
                        .is_some_and(|id| !style_ids.contains(id))
                    || node.catalog_reference.as_ref().is_some_and(|reference| {
                        reference.shape_id.trim().is_empty()
                            || reference.shape_id.chars().count() > 256
                            || reference.version.trim().is_empty()
                            || reference.version.chars().count() > 128
                    })
                {
                    return Err("The PeerCanvas document contains an invalid node.".into());
                }
            }
            for connection in &layer.connections {
                total_elements += 1;
                if !valid_uuid_v4(&connection.connection_id)
                    || !all_ids.insert(connection.connection_id.as_str())
                    || !ids.insert(connection.connection_id.as_str())
                    || connection.routing != "straight"
                    || connection.label.chars().count() > 100_000
                    || connection.source_node_id == connection.target_node_id
                    || !page_node_ids.contains(connection.source_node_id.as_str())
                    || !page_node_ids.contains(connection.target_node_id.as_str())
                    || connection
                        .style_id
                        .as_deref()
                        .is_some_and(|id| !style_ids.contains(id))
                {
                    return Err("The PeerCanvas document contains an invalid connection.".into());
                }
            }
        }
        page_elements.insert(page.page_id.as_str(), ids);
    }
    if total_layers > 1000 || total_elements > MAX_ELEMENTS {
        return Err("The PeerCanvas document exceeds supported element limits.".into());
    }

    if let Some(compatibility) = &document.source_compatibility {
        if compatibility.format != "drawio"
            || compatibility.version != 1
            || compatibility.pages.len() > MAX_PAGES
        {
            return Err("The draw.io compatibility data is invalid.".into());
        }
        let mut source_page_record_ids = HashSet::new();
        let mut source_page_ids = HashSet::new();
        let mut total_mappings = 0usize;
        let mut total_fragments = 0usize;
        let mut total_fragment_bytes = 0usize;
        for source_page in &compatibility.pages {
            if !page_ids.contains(source_page.page_id.as_str())
                || !xml_safe_identifier(&source_page.source_page_id)
                || source_page.source_page_id.chars().count() > 256
                || !source_page_record_ids.insert(source_page.page_id.as_str())
                || !source_page_ids.insert(source_page.source_page_id.as_str())
            {
                return Err("The draw.io compatibility page reference is invalid.".into());
            }
            let mut source_ids = HashSet::<String>::new();
            let mut mapped_ids = HashSet::new();
            for mapping in &source_page.cell_id_map {
                total_mappings += 1;
                if !xml_safe_identifier(&mapping.source_id)
                    || mapping.source_id == "0"
                    || !valid_uuid_v4(&mapping.element_id)
                    || !source_ids.insert(mapping.source_id.clone())
                    || !mapped_ids.insert(mapping.element_id.as_str())
                    || (all_ids.contains(mapping.element_id.as_str())
                        && !page_elements
                            .get(source_page.page_id.as_str())
                            .is_some_and(|ids| ids.contains(mapping.element_id.as_str())))
                {
                    return Err("The draw.io source cell map is invalid.".into());
                }
                if mapping.source_id == "1"
                    && page_elements
                        .get(source_page.page_id.as_str())
                        .is_some_and(|ids| ids.contains(mapping.element_id.as_str()))
                    && !document
                        .pages
                        .iter()
                        .find(|page| page.page_id == source_page.page_id)
                        .is_some_and(|page| {
                            page.layers
                                .iter()
                                .any(|layer| layer.layer_id == mapping.element_id)
                        })
                {
                    return Err("The source default-layer mapping must target a layer.".into());
                }
            }
            for fragment in &source_page.fragments {
                total_fragments += 1;
                total_fragment_bytes = total_fragment_bytes.saturating_add(fragment.len());
                let element = validate_fragment(fragment, &mut element_count)?;
                let id = attr(&element, "id")
                    .ok_or_else(|| "A preserved cell has no ID.".to_string())?;
                if !xml_safe_identifier(id) || !source_ids.insert(id.to_owned()) {
                    return Err(
                        "Preserved draw.io fragments contain duplicate or invalid IDs.".into(),
                    );
                }
            }
        }
        if total_mappings > MAX_SOURCE_ID_MAPPINGS
            || total_fragments > MAX_PRESERVED_FRAGMENTS
            || total_fragment_bytes > MAX_PRESERVED_TOTAL_BYTES
            || element_count > MAX_XML_ELEMENTS
        {
            return Err("The draw.io compatibility data exceeds supported limits.".into());
        }
    }
    Ok(())
}

fn xml_escape(value: &str, attribute: bool) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            '"' if attribute => escaped.push_str("&quot;"),
            '\'' if attribute => escaped.push_str("&apos;"),
            '\n' if attribute => escaped.push_str("&#10;"),
            '\r' if attribute => escaped.push_str("&#13;"),
            '\t' if attribute => escaped.push_str("&#9;"),
            _ => escaped.push(character),
        }
    }
    escaped
}

fn xml_number(value: f64) -> String {
    if value == 0.0 {
        "0".into()
    } else {
        value.to_string()
    }
}

fn style_for_id<'a>(id: Option<&str>, styles: &'a [Style]) -> Option<&'a Style> {
    id.and_then(|id| styles.iter().find(|style| style.style_id == id))
}

fn export_node_style(node: &Node, styles: &[Style]) -> String {
    let style = style_for_id(node.style_id.as_deref(), styles);
    let fill = style
        .map(|style| style.fill.as_deref().unwrap_or("none"))
        .unwrap_or("#ffffff");
    let stroke = style
        .map(|style| style.stroke.as_deref().unwrap_or("none"))
        .unwrap_or("#000000");
    let text_color = style
        .map(|style| style.text_color.as_str())
        .unwrap_or("#000000");
    let stroke_width = style.map(|style| style.stroke_width).unwrap_or(1.0);
    let font_size = style.map(|style| style.font_size).unwrap_or(16.0);
    if node.node_type == "text" {
        format!(
            "shape=text;html=0;fillColor=none;strokeColor=none;fontColor={text_color};fontSize={font_size};rotation={};",
            xml_number(node.geometry.rotation)
        )
    } else {
        format!(
            "shape=rectangle;rounded=0;whiteSpace=wrap;html=0;fillColor={fill};strokeColor={stroke};strokeWidth={stroke_width};fontColor={text_color};fontSize={font_size};rotation={};",
            xml_number(node.geometry.rotation)
        )
    }
}

fn export_connection_style(connection: &Connection, styles: &[Style]) -> String {
    let style = style_for_id(connection.style_id.as_deref(), styles);
    let stroke = style
        .map(|style| style.stroke.as_deref().unwrap_or("none"))
        .unwrap_or("#000000");
    let text_color = style
        .map(|style| style.text_color.as_str())
        .unwrap_or("#000000");
    let stroke_width = style.map(|style| style.stroke_width).unwrap_or(1.0);
    let font_size = style.map(|style| style.font_size).unwrap_or(16.0);
    format!(
        "edgeStyle=none;endArrow=none;startArrow=none;html=0;strokeColor={stroke};strokeWidth={stroke_width};fontColor={text_color};fontSize={font_size};"
    )
}

fn document_page_elements(page: &Page) -> HashSet<&str> {
    let mut ids = HashSet::new();
    for layer in &page.layers {
        ids.insert(layer.layer_id.as_str());
        for node in &layer.nodes {
            ids.insert(node.node_id.as_str());
        }
        for connection in &layer.connections {
            ids.insert(connection.connection_id.as_str());
        }
    }
    ids
}

fn fragment_reference_ids(fragment: &XmlElement) -> Vec<&str> {
    ["parent", "source", "target"]
        .iter()
        .filter_map(|key| attr(fragment, key))
        .collect()
}

fn fragments_that_can_export(
    fragments: &[(String, XmlElement)],
    source_mappings: &HashMap<&str, &str>,
    live_ids: &HashSet<&str>,
) -> Vec<bool> {
    let by_fragment_id = fragments
        .iter()
        .enumerate()
        .filter_map(|(index, (_, element))| attr(element, "id").map(|id| (id, index)))
        .collect::<HashMap<_, _>>();
    let mut keep = fragments
        .iter()
        .map(|(_, element)| {
            fragment_reference_ids(element)
                .into_iter()
                .all(|reference| {
                    if reference == "0" {
                        return true;
                    }
                    if let Some(element_id) = source_mappings.get(reference) {
                        return live_ids.contains(element_id);
                    }
                    by_fragment_id.contains_key(reference)
                })
        })
        .collect::<Vec<_>>();
    loop {
        let mut changed = false;
        for (index, (_, element)) in fragments.iter().enumerate() {
            if !keep[index] {
                continue;
            }
            let still_resolves = fragment_reference_ids(element)
                .into_iter()
                .all(|reference| {
                    by_fragment_id
                        .get(reference)
                        .is_none_or(|target_index| keep[*target_index])
                });
            if !still_resolves {
                keep[index] = false;
                changed = true;
            }
        }
        if !changed {
            return keep;
        }
    }
}

fn prepare_export(document: Document) -> Result<DrawioExportCandidate, String> {
    let compatibility = document.source_compatibility.as_ref();
    let source_pages_by_page = compatibility
        .into_iter()
        .flat_map(|compatibility| compatibility.pages.iter())
        .map(|page| (page.page_id.as_str(), page))
        .collect::<HashMap<_, _>>();
    let mut xml = String::new();
    let title = xml_escape(&document.metadata.title, true);
    xml.push_str(&format!(
        "<mxfile host=\"app.diagrams.net\" type=\"device\" name=\"{title}\">"
    ));
    let mut losses = Vec::new();
    if !document.metadata.description.is_empty() {
        push_loss(
            &mut losses,
            "Document description is not represented in draw.io exports.",
        );
    }
    let mut preserved_fragment_count = 0usize;
    let mut next_id = 1usize;

    for page in &document.pages {
        let source_page = source_pages_by_page.get(page.page_id.as_str()).copied();
        let source_map = source_page
            .map(|source_page| source_page.cell_id_map.as_slice())
            .unwrap_or_default();
        let mut reserved_ids = HashSet::from(["0".to_owned()]);
        let mut source_id_by_element = HashMap::<&str, &str>::new();
        for mapping in source_map {
            reserved_ids.insert(mapping.source_id.clone());
            source_id_by_element.insert(&mapping.element_id, &mapping.source_id);
        }
        let mut fragment_elements = Vec::<(String, XmlElement)>::new();
        let mut fragment_ids = HashSet::new();
        if let Some(source_page) = source_page {
            let mut element_count = 0;
            for fragment in &source_page.fragments {
                let element = validate_fragment(fragment, &mut element_count)?;
                if let Some(id) = attr(&element, "id") {
                    reserved_ids.insert(id.to_owned());
                    fragment_ids.insert(id.to_owned());
                }
                fragment_elements.push((fragment.clone(), element));
            }
        }
        let live_page_ids = document_page_elements(page);
        let mut id_by_element = HashMap::<&str, String>::new();
        let mut used_output_ids = HashSet::from(["0".to_owned()]);
        let element_ids = page
            .layers
            .iter()
            .flat_map(|layer| {
                std::iter::once(layer.layer_id.as_str())
                    .chain(layer.nodes.iter().map(|node| node.node_id.as_str()))
                    .chain(
                        layer
                            .connections
                            .iter()
                            .map(|connection| connection.connection_id.as_str()),
                    )
            })
            .collect::<Vec<_>>();
        for element_id in &element_ids {
            if let Some(source_id) = source_id_by_element.get(element_id) {
                if *source_id == "0" || !used_output_ids.insert((*source_id).to_owned()) {
                    return Err("The draw.io source map contains conflicting export IDs.".into());
                }
                id_by_element.insert(element_id, (*source_id).to_owned());
            }
        }
        for element_id in element_ids {
            if id_by_element.contains_key(element_id) {
                continue;
            }
            loop {
                let candidate = format!("pc{next_id}");
                next_id += 1;
                if !reserved_ids.contains(&candidate) && used_output_ids.insert(candidate.clone()) {
                    id_by_element.insert(element_id, candidate);
                    break;
                }
            }
        }

        let source_page_id = source_page
            .map(|source_page| source_page.source_page_id.as_str())
            .unwrap_or(&page.page_id);
        xml.push_str(&format!(
            "<diagram id=\"{}\" name=\"{}\"><mxGraphModel><root><mxCell id=\"0\"/>",
            xml_escape(source_page_id, true),
            xml_escape(&page.name, true)
        ));
        for layer in &page.layers {
            let id = &id_by_element[layer.layer_id.as_str()];
            xml.push_str(&format!(
                "<mxCell id=\"{}\" value=\"{}\" parent=\"0\"/>",
                xml_escape(id, true),
                xml_escape(&layer.name, true)
            ));
        }
        for layer in &page.layers {
            for node in &layer.nodes {
                let id = &id_by_element[node.node_id.as_str()];
                let parent = &id_by_element[layer.layer_id.as_str()];
                let style = xml_escape(&export_node_style(node, &document.styles), true);
                if node.catalog_reference.is_some() {
                    push_loss(
                        &mut losses,
                        "Catalog shape references are represented as ordinary rectangles or text in draw.io exports.",
                    );
                }
                xml.push_str(&format!(
                    "<mxCell id=\"{}\" value=\"{}\" style=\"{}\" vertex=\"1\" parent=\"{}\"><mxGeometry x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" as=\"geometry\"/></mxCell>",
                    xml_escape(id, true),
                    xml_escape(&node.text, true),
                    style,
                    xml_escape(parent, true),
                    xml_number(node.geometry.x),
                    xml_number(node.geometry.y),
                    xml_number(node.geometry.width),
                    xml_number(node.geometry.height),
                ));
            }
        }
        for layer in &page.layers {
            for connection in &layer.connections {
                let id = &id_by_element[connection.connection_id.as_str()];
                let parent = &id_by_element[layer.layer_id.as_str()];
                let source = &id_by_element[connection.source_node_id.as_str()];
                let target = &id_by_element[connection.target_node_id.as_str()];
                let style =
                    xml_escape(&export_connection_style(connection, &document.styles), true);
                xml.push_str(&format!(
                    "<mxCell id=\"{}\" value=\"{}\" style=\"{}\" edge=\"1\" parent=\"{}\" source=\"{}\" target=\"{}\"><mxGeometry relative=\"1\" as=\"geometry\"/></mxCell>",
                    xml_escape(id, true),
                    xml_escape(&connection.label, true),
                    style,
                    xml_escape(parent, true),
                    xml_escape(source, true),
                    xml_escape(target, true),
                ));
            }
        }

        if let Some(source_page) = source_page {
            let source_mappings = source_page
                .cell_id_map
                .iter()
                .map(|mapping| (mapping.source_id.as_str(), mapping.element_id.as_str()))
                .collect::<HashMap<_, _>>();
            let keep_fragments =
                fragments_that_can_export(&fragment_elements, &source_mappings, &live_page_ids);
            for ((fragment, _), should_export) in fragment_elements.iter().zip(keep_fragments) {
                if should_export {
                    xml.push_str(fragment);
                    preserved_fragment_count += 1;
                } else {
                    push_loss(
                        &mut losses,
                        "A preserved draw.io cell references a deleted or unavailable element and was omitted.",
                    );
                }
            }
        }
        xml.push_str("</root></mxGraphModel></diagram>");
    }
    xml.push_str("</mxfile>");
    validate_drawio_xml(&xml)?;
    Ok(DrawioExportCandidate {
        xml,
        losses,
        preserved_fragment_count,
    })
}

pub fn prepare_drawio_export(document_json: &str) -> Result<DrawioExportCandidate, String> {
    if document_json.len() > MAX_DRAWIO_BYTES {
        return Err("The PeerCanvas document exceeds the 10 MiB input limit.".into());
    }
    let value = parse_unique_json(document_json)?;
    if !document_shape_is_exact(&value) {
        return Err("The PeerCanvas document does not match schema v2.".into());
    }
    let document = serde_json::from_value::<Document>(value)
        .map_err(|_| "The PeerCanvas document does not match schema v2.".to_string())?;
    validate_document(&document)?;
    prepare_export(document)
}

pub fn validate_drawio_xml(xml: &str) -> Result<(), String> {
    if xml.is_empty() || xml.len() > MAX_DRAWIO_BYTES {
        return Err("The draw.io export exceeds the 10 MiB output limit.".into());
    }
    let mut element_count = 0;
    let root = parse_xml_tree(xml, &mut element_count)?;
    if root.name != "mxfile" || element_count > MAX_XML_ELEMENTS {
        return Err("The draw.io export is invalid or exceeds parser limits.".into());
    }
    check_active_content(&root)?;
    let pages = root
        .children
        .iter()
        .filter(|child| child.name == "diagram")
        .count();
    if pages == 0 || pages > MAX_PAGES {
        return Err("The draw.io export must contain between 1 and 100 pages.".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::{Compression, write::DeflateEncoder};
    use std::io::Write;

    const NOW: &str = "2026-11-12T10:15:30.000Z";
    const BASIC: &[u8] = include_bytes!("../../tests/fixtures/drawio/basic-uncompressed.drawio");
    const COMPRESSED: &[u8] = include_bytes!("../../tests/fixtures/drawio/compressed-page.drawio");
    const LINKED: &[u8] =
        include_bytes!("../../tests/fixtures/drawio/safe-linked-unsupported.drawio");
    const SETTING: &[u8] = include_bytes!("../../tests/fixtures/drawio/unsupported-setting.drawio");
    const DOCTYPE: &[u8] = include_bytes!("../../tests/fixtures/drawio/doctype-entity.drawio");
    const MALFORMED: &[u8] = include_bytes!("../../tests/fixtures/drawio/malformed.drawio");
    const UNSAFE_SVG: &[u8] = include_bytes!("../../tests/fixtures/drawio/unsafe-svg.drawio");

    fn import(bytes: &[u8]) -> DrawioImportCandidate {
        parse_drawio_document(bytes, "Fixture diagram", NOW).expect("fixture import should succeed")
    }

    fn element_totals(document: &Value) -> (usize, usize) {
        let pages = document["pages"].as_array().unwrap();
        pages.iter().fold((0, 0), |(nodes, connections), page| {
            page["layers"].as_array().unwrap().iter().fold(
                (nodes, connections),
                |(nodes, connections), layer| {
                    (
                        nodes + layer["nodes"].as_array().unwrap().len(),
                        connections + layer["connections"].as_array().unwrap().len(),
                    )
                },
            )
        })
    }

    #[test]
    fn imports_uncompressed_fixture_and_round_trips_supported_semantics() {
        let candidate = import(BASIC);
        assert_eq!(element_totals(&candidate.document), (2, 1));
        assert!(candidate.losses.is_empty());
        assert_eq!(candidate.preserved_fragment_count, 0);
        let page = &candidate.document["pages"][0];
        assert_eq!(page["name"], "Main");
        assert_eq!(page["layers"][0]["nodes"][0]["text"], "Client");
        assert_eq!(page["layers"][0]["nodes"][0]["geometry"]["x"], 80.0);
        assert_eq!(page["layers"][0]["connections"][0]["label"], "calls");

        let exported = prepare_drawio_export(&candidate.document.to_string()).unwrap();
        validate_drawio_xml(&exported.xml).unwrap();
        let reopened = parse_drawio_document(exported.xml.as_bytes(), "Round trip", NOW).unwrap();
        assert_eq!(element_totals(&reopened.document), (2, 1));
        assert_eq!(reopened.preserved_fragment_count, 0);
        assert_eq!(
            reopened.document["pages"][0]["layers"][0]["nodes"][0]["text"],
            "Client"
        );
    }

    #[test]
    fn imports_uri_encoded_raw_deflate_fixture() {
        let candidate = import(COMPRESSED);
        assert_eq!(candidate.document["pages"].as_array().unwrap().len(), 1);
        assert_eq!(element_totals(&candidate.document), (1, 0));
        assert!(candidate.losses.is_empty());
        assert_eq!(candidate.document["pages"][0]["name"], "Compressed");
    }

    #[test]
    fn imports_plain_text_with_escaped_angle_brackets() {
        let graph = r#"<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="x &lt; 5 &gt; 2; javascript: is text" style="shape=text;html=0;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="120" height="30" as="geometry"/></mxCell></root></mxGraphModel>"#;
        let candidate = parse_drawio_document(graph.as_bytes(), "Operators", NOW).unwrap();
        assert_eq!(
            candidate.document["pages"][0]["layers"][0]["nodes"][0]["text"],
            "x < 5 > 2; javascript: is text"
        );
        let exported = prepare_drawio_export(&candidate.document.to_string()).unwrap();
        let round_trip = parse_drawio_document(exported.xml.as_bytes(), "Operators", NOW).unwrap();
        assert_eq!(
            round_trip.document["pages"][0]["layers"][0]["nodes"][0]["text"],
            "x < 5 > 2; javascript: is text"
        );
    }

    #[test]
    fn preserves_safe_unknown_cell_and_its_mapped_links() {
        let candidate = import(LINKED);
        assert_eq!(element_totals(&candidate.document), (2, 0));
        assert_eq!(candidate.preserved_fragment_count, 1);
        assert!(candidate.losses.is_empty());
        let exported = prepare_drawio_export(&candidate.document.to_string()).unwrap();
        assert_eq!(exported.preserved_fragment_count, 1);
        assert!(exported.xml.contains("id=\"legacy-edge\""));
        assert!(exported.xml.contains("source=\"a\""));
        assert!(exported.xml.contains("target=\"b\""));
        validate_drawio_xml(&exported.xml).unwrap();
    }

    #[test]
    fn stale_fragment_reference_is_retained_but_omitted_with_loss() {
        let mut candidate = import(LINKED);
        let compatibility = candidate.document["sourceCompatibility"]["pages"][0].clone();
        let mapping = compatibility["cellIdMap"]
            .as_array()
            .unwrap()
            .iter()
            .find(|mapping| mapping["sourceId"] == "a")
            .unwrap();
        let removed_id = mapping["elementId"].as_str().unwrap();
        let nodes = candidate.document["pages"][0]["layers"][0]["nodes"]
            .as_array_mut()
            .unwrap();
        let index = nodes
            .iter()
            .position(|node| node["nodeId"] == removed_id)
            .unwrap();
        nodes.remove(index);

        let exported = prepare_drawio_export(&candidate.document.to_string()).unwrap();
        assert_eq!(
            candidate.document["sourceCompatibility"]["pages"][0]["fragments"]
                .as_array()
                .unwrap()
                .len(),
            1
        );
        assert_eq!(exported.preserved_fragment_count, 0);
        assert!(
            exported
                .losses
                .iter()
                .any(|loss| loss.contains("deleted or unavailable"))
        );
        assert!(!exported.xml.contains("legacy-edge"));
    }

    #[test]
    fn reports_unmapped_graph_settings() {
        let candidate = import(SETTING);
        assert_eq!(element_totals(&candidate.document), (1, 0));
        assert_eq!(candidate.losses, ["mxGraphModel.grid"]);
    }

    #[test]
    fn rejects_doctype_and_malformed_xml_fixtures() {
        assert!(parse_drawio_document(DOCTYPE, "Hostile", NOW).is_err());
        assert!(parse_drawio_document(MALFORMED, "Malformed", NOW).is_err());
        assert!(parse_drawio_document(UNSAFE_SVG, "Unsafe SVG", NOW).is_err());
    }

    #[test]
    fn rejects_scripts_handlers_and_external_resources_before_mapping() {
        for xml in [
            r#"<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="x" style="rounded=0;" vertex="1" parent="1" onclick="alert(1)"><mxGeometry x="0" y="0" width="1" height="1" as="geometry"/></mxCell></root></mxGraphModel>"#,
            r#"<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="x" style="shape=image;image=https://evil.invalid/a.svg" vertex="1" parent="1"><mxGeometry x="0" y="0" width="1" height="1" as="geometry"/></mxCell></root></mxGraphModel>"#,
            r#"<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="2" value="&lt;script&gt;alert(1)&lt;/script&gt;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="1" height="1" as="geometry"/></mxCell></root></mxGraphModel>"#,
        ] {
            assert!(parse_drawio_document(xml.as_bytes(), "Hostile", NOW).is_err());
        }
    }

    #[test]
    fn rejects_duplicate_json_keys_and_invalid_schema() {
        assert!(prepare_drawio_export(r#"{"schemaVersion":2,"schemaVersion":2}"#).is_err());
        assert!(prepare_drawio_export("{}").is_err());
    }

    #[test]
    fn rejects_xml_resource_limits() {
        let oversized = vec![b' '; MAX_DRAWIO_BYTES + 1];
        assert!(parse_drawio_document(&oversized, "Too large", NOW).is_err());

        let mut too_many = String::from("<mxGraphModel>");
        for _ in 0..MAX_XML_ELEMENTS {
            too_many.push_str("<x/>");
        }
        too_many.push_str("</mxGraphModel>");
        assert!(parse_drawio_document(too_many.as_bytes(), "Limit", NOW).is_err());

        let too_deep = format!(
            "{}<mxCell/>{}</mxGraphModel>",
            "<mxGraphModel>".repeat(MAX_XML_DEPTH),
            "</mxGraphModel>".repeat(MAX_XML_DEPTH)
        );
        assert!(parse_drawio_document(too_deep.as_bytes(), "Depth", NOW).is_err());
    }

    #[test]
    fn rejects_page_and_preserved_fragment_limits() {
        let graph = "<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/></root></mxGraphModel>";
        let pages = format!(
            "<mxfile>{}</mxfile>",
            format!("<diagram>{graph}</diagram>").repeat(MAX_PAGES + 1)
        );
        assert!(parse_drawio_document(pages.as_bytes(), "Many pages", NOW).is_err());

        let mut fragment_count =
            String::from("<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>");
        for index in 0..=MAX_PRESERVED_FRAGMENTS {
            fragment_count.push_str(&format!("<mxCell id=\"u{index}\" parent=\"1\"/>"));
        }
        fragment_count.push_str("</root></mxGraphModel>");
        assert!(parse_drawio_document(fragment_count.as_bytes(), "Many fragments", NOW).is_err());

        let large_value = "A".repeat(MAX_PRESERVED_FRAGMENT_BYTES + 1);
        let large_fragment = format!(
            "<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/><mxCell id=\"large\" parent=\"1\" value=\"{large_value}\"/></root></mxGraphModel>"
        );
        assert!(parse_drawio_document(large_fragment.as_bytes(), "Large fragment", NOW).is_err());

        let repeated_value = "B".repeat(1200);
        let mut total_fragments =
            String::from("<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/>");
        for index in 0..MAX_PRESERVED_FRAGMENTS {
            total_fragments.push_str(&format!(
                "<mxCell id=\"t{index}\" parent=\"1\" value=\"{repeated_value}\"/>"
            ));
        }
        total_fragments.push_str("</root></mxGraphModel>");
        assert!(parse_drawio_document(total_fragments.as_bytes(), "Total fragments", NOW).is_err());
    }

    #[test]
    fn rejects_compressed_page_expansion_above_ratio_limit() {
        let graph = format!(
            "<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/><mxCell id=\"2\" value=\"{}\" vertex=\"1\" parent=\"1\"><mxGeometry x=\"0\" y=\"0\" width=\"10\" height=\"10\" as=\"geometry\"/></mxCell></root></mxGraphModel>",
            "A".repeat(50_000)
        );
        let uri_encoded =
            percent_encoding::utf8_percent_encode(&graph, percent_encoding::NON_ALPHANUMERIC)
                .to_string();
        let mut encoder = DeflateEncoder::new(Vec::new(), Compression::best());
        encoder.write_all(uri_encoded.as_bytes()).unwrap();
        let compressed = encoder.finish().unwrap();
        let encoded = BASE64.encode(compressed);
        let input = format!("<mxfile><diagram>{encoded}</diagram></mxfile>");
        assert!(parse_drawio_document(input.as_bytes(), "Bomb", NOW).is_err());
    }

    #[test]
    fn enforces_total_decoded_xml_limit_across_compressed_pages() {
        let mut state = 0x1234_5678u32;
        let mut payload = String::with_capacity(5 * 1024 * 1024);
        for index in 0..5 * 1024 * 1024 {
            if index % 10 == 0 {
                state = state.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
                payload.push(char::from(b'a' + (state % 26) as u8));
            } else {
                payload.push('A');
            }
        }
        let graph = format!(
            "<mxGraphModel><root><mxCell id=\"0\"/><mxCell id=\"1\" parent=\"0\"/><extra value=\"{payload}\"/></root></mxGraphModel>"
        );
        let uri_encoded =
            percent_encoding::utf8_percent_encode(&graph, percent_encoding::NON_ALPHANUMERIC)
                .to_string();
        let mut encoder = DeflateEncoder::new(Vec::new(), Compression::best());
        encoder.write_all(uri_encoded.as_bytes()).unwrap();
        let encoded_page = BASE64.encode(encoder.finish().unwrap());
        let input = format!(
            "<mxfile><diagram id=\"one\">{encoded_page}</diagram><diagram id=\"two\">{encoded_page}</diagram></mxfile>"
        );
        let error = parse_drawio_document(input.as_bytes(), "Decoded limit", NOW).unwrap_err();
        assert!(
            error.contains("10 MiB decoded XML limit"),
            "unexpected error: {error}"
        );
    }

    #[test]
    fn accepts_a_bare_graph_model_and_preserves_page_order() {
        let graph = r#"<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>"#;
        let bare = parse_drawio_document(graph.as_bytes(), "Bare graph", NOW).unwrap();
        assert_eq!(bare.document["pages"][0]["name"], "Bare graph");

        let multi = format!(
            "<mxfile><diagram id=\"first\" name=\"One\">{graph}</diagram><diagram id=\"second\" name=\"Two\">{graph}</diagram></mxfile>"
        );
        let candidate = parse_drawio_document(multi.as_bytes(), "Multi", NOW).unwrap();
        let pages = candidate.document["pages"].as_array().unwrap();
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0]["name"], "One");
        assert_eq!(pages[1]["name"], "Two");
    }

    #[test]
    fn reports_an_invalid_source_page_id_replaced_with_a_generated_id() {
        let graph = r#"<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel>"#;
        let source = format!("<mxfile><diagram id=\"\">{graph}</diagram></mxfile>");
        let candidate = parse_drawio_document(source.as_bytes(), "Page ID", NOW).unwrap();

        assert_eq!(
            candidate.document["sourceCompatibility"]["pages"][0]["sourcePageId"],
            "page-1"
        );
        assert!(
            candidate
                .losses
                .iter()
                .any(|loss| loss.contains("invalid source page ID"))
        );
    }

    #[test]
    fn omits_fragments_that_depend_on_another_omitted_fragment() {
        let source = r#"<mxGraphModel><root>
          <mxCell id="0"/><mxCell id="1" parent="0"/>
          <mxCell id="a" value="A" style="rounded=0;" vertex="1" parent="1"><mxGeometry x="0" y="0" width="10" height="10" as="geometry"/></mxCell>
          <mxCell id="b" value="B" style="rounded=0;" vertex="1" parent="1"><mxGeometry x="20" y="0" width="10" height="10" as="geometry"/></mxCell>
          <mxCell id="fragment-b" edge="1" parent="1" source="a" target="b"/>
          <mxCell id="fragment-a" edge="1" parent="1" source="fragment-b" target="b"/>
        </root></mxGraphModel>"#;
        let mut candidate =
            parse_drawio_document(source.as_bytes(), "Linked fragments", NOW).unwrap();
        let removed_id = candidate.document["sourceCompatibility"]["pages"][0]["cellIdMap"]
            .as_array()
            .unwrap()
            .iter()
            .find(|mapping| mapping["sourceId"] == "a")
            .unwrap()["elementId"]
            .as_str()
            .unwrap()
            .to_owned();
        let nodes = candidate.document["pages"][0]["layers"][0]["nodes"]
            .as_array_mut()
            .unwrap();
        let index = nodes
            .iter()
            .position(|node| node["nodeId"] == removed_id)
            .unwrap();
        nodes.remove(index);
        let exported = prepare_drawio_export(&candidate.document.to_string()).unwrap();
        assert_eq!(exported.preserved_fragment_count, 0);
        assert!(!exported.xml.contains("fragment-a") && !exported.xml.contains("fragment-b"));
    }
}
