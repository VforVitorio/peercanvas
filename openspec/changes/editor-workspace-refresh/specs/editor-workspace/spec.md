# Spec Delta

## Purpose

Defines an accessible, responsive workspace for implemented local diagram editing, navigation, and document workflows without introducing another document authority.

## ADDED Requirements

### Requirement: Present real document actions and state

The workspace SHALL provide an editable document title, actual new/dirty/saved/busy/recovered state, File actions, Save, Undo, Redo, Preferences, and shortcut help without implying unimplemented features.

#### Scenario: Manage a local document

- **WHEN** the user opens the File menu
- **THEN** implemented New, Open, Reopen last, Save As, draw.io Import/Export, and Close actions are reachable with accurate disabled states
- **AND** all existing unsaved-change, recovery, and loss-review decisions remain required

#### Scenario: An operation fails

- **WHEN** a file, command, or preference operation fails
- **THEN** an accessible, persistent error explains the failure and the document remains protected by its existing validation and recovery boundaries

### Requirement: Organize navigation and contextual inspection

The workspace SHALL separate Shapes and Structure navigation and SHALL show supported properties for the current node, connection, or empty selection. Applied edits SHALL use the validated command boundary.

#### Scenario: Browse and insert a shape

- **WHEN** the user searches the Shapes panel
- **THEN** approved matching shapes and expandable source/license information are available and insertion uses the existing shape command

#### Scenario: Navigate structure

- **WHEN** the user selects Structure
- **THEN** pages, layers, elements, and connections are reachable and existing create/rename/selection operations retain canonical identifiers and ordering

#### Scenario: Inspect a node or connection

- **WHEN** a node or connection is selected
- **THEN** the inspector shows the implemented text, geometry, appearance, endpoint, and label properties relevant to that selection
- **AND** Apply actions commit valid drafts while invalid drafts leave the document unchanged

### Requirement: Keep the canvas usable across window sizes

The workspace SHALL keep the canvas accessible with independently scrollable panels, page/layer context, and zoom/fit controls. It SHALL use side panels on wide windows, a left drawer on medium windows, and two drawers on small windows.

#### Scenario: Resize the workspace

- **WHEN** the width crosses 1280, 1024, or 760 CSS pixels
- **THEN** panel widths or drawer presentation adapt without hiding the canvas or losing document/selection state

### Requirement: Support keyboard and focus navigation

The workspace SHALL preserve existing editing shortcuts, input guards, accessible names, visible focus, and keyboard paths to essential actions. Menus and dialogs SHALL manage focus and restore it when dismissed.

#### Scenario: Open help with the keyboard

- **WHEN** the user opens shortcut help or Preferences and then dismisses it
- **THEN** focus stays within the open dialog, returns to the invoking control on dismissal, and no diagram mutation occurs

#### Scenario: A protected workflow is pending

- **WHEN** an unsaved-change decision, recovery, loss review, or file operation locks editing
- **THEN** canvas gestures, keyboard edits, and property actions cannot bypass that lock

### Requirement: Apply appearance and language independently

The workspace SHALL consume the desktop-preferences theme and language settings for chrome, dialogs, status, help, and accessible labels while preserving document text, colors, bytes, revision, dirty state, and history.

#### Scenario: Change language and theme during editing

- **WHEN** the user changes English/Spanish and System/Light/Dark
- **THEN** interface text and chrome update without changing the diagram, its white paper, selection, accepted history, or pending drafts
- **AND** existing errors and loss reviews remain understandable in the selected language
