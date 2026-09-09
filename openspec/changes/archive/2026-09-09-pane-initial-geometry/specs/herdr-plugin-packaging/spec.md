## ADDED Requirements

### Requirement: Resolve the pane geometry at startup

The pane SHALL resolve the terminal width and height it renders with before it draws its first frame, and SHALL NOT rely on the process's own standard output reporting the pane's real size at that moment. Herdr gives a newly created plugin pane a pty that still carries the size the pane had before the split, and it does not resize that pty until the pane's focus changes, so the process's own view of its size is wrong for the whole first frame.

When the invocation context carries a pane id and a Herdr binary, the pane SHALL ask Herdr for its own geometry. The width SHALL come from the `rect.width` of the pane's own entry in the layout Herdr reports for that pane.

The height SHALL be the smaller of two values: the `scroll.viewport_rows` Herdr reports for the pane, and that same layout entry's `rect.height` less the two rows Herdr draws around a pane. Neither value can be trusted on its own. `scroll.viewport_rows` is the pty's own row count, so for a pane Herdr has just created it still carries the pre-split height. `rect.height` is right from the moment the pane exists but counts the pane's own chrome as well as the rows the pty has. Taking the smaller of the two uses whichever is currently right, and leaves the frame shorter than the pane rather than overflowing it if the number of chrome rows ever changes.

The resolution SHALL fail as a whole rather than in part: unless both the width and the height are obtained, the pane SHALL fall back to the size its standard output reports. It SHALL fall back the same way when the invocation context carries no pane id, when no Herdr binary is available, when either Herdr call exits non-zero, when either response cannot be parsed, when the pane's own id is absent from the reported layout, or when any of `rect.width`, `rect.height`, and `scroll.viewport_rows` is missing. A failed resolution SHALL be silent: it SHALL NOT write to stderr, SHALL NOT appear in the status bar, and SHALL NOT prevent the pane from starting.

Once the first frame is drawn, later size changes SHALL continue to come from the standard output resize event, unchanged.

#### Scenario: Geometry comes from Herdr rather than from the pty

- **GIVEN** the invocation context carries pane id `p7` and a Herdr binary, Herdr reports `rect.width` 39, `rect.height` 48 and `scroll.viewport_rows` 46 for `p7`, and the process's standard output reports 78 columns and 48 rows
- **WHEN** the pane starts
- **THEN** it renders its first frame at 39 columns and 46 rows

#### Scenario: A stale viewport row count does not win

- **GIVEN** the pane was just created, so Herdr reports `rect.height` 24 for it while `scroll.viewport_rows` still carries the pre-split 48
- **WHEN** the pane resolves its geometry
- **THEN** the resolved height is 22

#### Scenario: A settled pane resolves the same height from either value

- **GIVEN** Herdr reports `rect.height` 24 and `scroll.viewport_rows` 22 for the pane
- **WHEN** the pane resolves its geometry
- **THEN** the resolved height is 22

#### Scenario: A pane id absent from the layout falls back

- **GIVEN** the invocation context carries pane id `p7` but the layout Herdr reports contains no entry for `p7`
- **WHEN** the pane resolves its geometry
- **THEN** the resolution fails, the pane uses the size its standard output reports, and nothing is written to stderr

#### Scenario: Running outside Herdr falls back

- **GIVEN** the invocation context carries no pane id
- **WHEN** the pane starts
- **THEN** no Herdr call is made, the pane uses the size its standard output reports, and the pane starts normally

#### Scenario: A partial answer is not used

- **GIVEN** Herdr reports a width for the pane but the call that reports `scroll.viewport_rows` exits non-zero
- **WHEN** the pane resolves its geometry
- **THEN** neither value is used and the pane uses the size its standard output reports for both dimensions

##### Example: resolved geometry per Herdr response

| Herdr `rect.width` | Herdr `rect.height` | Herdr `scroll.viewport_rows` | stdout size | Resolved size |
| ------------------ | ------------------- | ---------------------------- | ----------- | ------------- |
| 39                 | 48                  | 46                           | 78 x 48     | 39 x 46       |
| 77                 | 24                  | 48                           | 155 x 48    | 77 x 22       |
| 39                 | 24                  | 22                           | 78 x 48     | 39 x 22       |
| 39                 | 48                  | missing                      | 78 x 48     | 78 x 48       |
| missing            | missing             | 46                           | 78 x 48     | 78 x 48       |
| call fails         | call fails          | call fails                   | 78 x 48     | 78 x 48       |
