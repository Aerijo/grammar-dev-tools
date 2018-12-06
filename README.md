# Grammar Dev Tools

A collection of tools to make developing grammars (TextMate and Tree-sitter) easier in Atom.

### Features (planned)
- Persistent popup box at cursor for current scope and / or tree path
- Doctor grammar packages
  - Inspect installation process (e.g., if it depends on build tools)
  - Validate grammar files
    - Deprecated properties
    - Missing properties
    - Mispelled properties
- Generate relational view of grammar
- Generate all scopes used by grammar
- Links to development guides


### Guide (TODO)

Some notes:
- The scopes are for the character immediately following the cursor. So `a|bc` would report the scopes for `b`.
  - Note it gets weird when at the end of a line. Because we more often care about the character at the end of the line, and not the newline character itself, the scope is manually adjusted to compensate. So both `ab|c` and `abc|` report the scope of `c`. This behaviour can be toggled in settings.
  - Disabling this will show you the true scopes, which may be more helpful when debugging the grammar. Enabling it will show what scope checkers see, which helps debugging things like autocomplete (the completions are scope sensitive).
- Immediate scope refers to the range over which no scopes change, whereas the "proper" range is generally wider. E.g., for `let foo = "b|ar"` the text in the immediate scope is `bar` (and same for proper scope). However, for `let foo =| "bar"` the immediate text is ` ` (the space between `=` and `"`), but the proper scope is the entire text (because the scope of ` ` is `source.js`).
