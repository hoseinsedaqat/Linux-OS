# Keyboard shortcuts

## Global

| Shortcut | Action |
| --- | --- |
| `Ctrl / Cmd + K` | Command palette (apps, windows, actions, workspaces) |
| `Ctrl + Alt + T` | Terminal |
| `Ctrl + Alt + L` | Lock session |
| `Ctrl + Alt + ↑` | Window overview (Exposé) |
| `Ctrl + Alt + ← / →` | Previous / next virtual desktop |
| `Shift + ?` | Keyboard shortcut sheet |
| `Alt + Tab` | Focus next window |
| `Esc` | Close menu / dialog / overlay / palette |

## Window manager

| Shortcut / gesture | Action |
| --- | --- |
| Drag title bar | Move window |
| Drag to top edge | Maximise on release |
| Drag to left / right edge | Tile to that half |
| Drag into a corner | Tile to that quarter |
| `Super + ← / →` | Tile active window to a half |
| `Super + ↑` | Maximise |
| `Super + ↓` | Restore a snapped window / minimise |
| Double-click title bar | Toggle maximise |
| Drag any window edge/corner | Resize (eight handles) |
| Right-click title bar | Window menu (restore, tile, move to workspace, close) |
| Right-click desktop | Desktop menu (new folder, new text file, wallpaper, display settings) |

## Files

| Shortcut | Action |
| --- | --- |
| `Enter` | Open selection |
| `F2` | Rename |
| `Delete` | Move to Trash (or delete permanently inside Trash) |
| `Ctrl / Cmd + A` | Select all |
| `Ctrl / Cmd + C` / `X` / `V` | Copy / cut / paste |
| `Esc` | Clear selection |
| `Ctrl` + click | Multi-select |
| Drag & drop onto a folder | Move |

## Office

### Writer
| Shortcut | Action |
| --- | --- |
| `Ctrl / Cmd + B` / `I` / `U` | Bold / italic / underline |
| `Ctrl / Cmd + S` | Save to the virtual file system |
| `Ctrl / Cmd + F` | Find & replace bar |
| `Esc` | Close find bar / preview |

### Calc
| Shortcut | Action |
| --- | --- |
| Arrow keys | Move the active cell |
| `Enter` / `Tab` | Commit and move down / right |
| `Ctrl / Cmd + C` / `V` | Copy / paste a cell |
| `Delete` / `Backspace` | Clear cell |
| `F2` or typing | Edit the cell |

### Impress
| Shortcut | Action |
| --- | --- |
| `F5` | Start the slide show |
| `→` / `←` / `Space` | Next / previous slide |
| `Esc` | End the slide show |

## Terminal

| Command | Effect |
| --- | --- |
| `help` | List commands |
| `ls [path]` | List a directory |
| `cd <path>` | Change directory (`..` and `~` supported, sandboxed to the virtual FS) |
| `pwd` | Print working directory |
| `mkdir <name>` / `touch <name>` | Create a folder / empty file |
| `cat <file>` | Print a file |
| `echo <text> > <file>` | Write a file |
| `history` | Command history (↑ / ↓ to recall) |
| `neofetch` | Simulated system information |
| `open <path>` | Open a file in the desktop |
| `clear` | Clear the screen |

`sudo`, package managers and anything touching the real machine are explicitly rejected with an
explanation — the shell only sees the simulated virtual file system.

## Games

### Minesweeper
| Input | Action |
| --- | --- |
| Left click | Reveal a cell (first click is always safe) |
| Right click / long press | Place or remove a flag |
| Click a revealed number with all mines flagged | Chord: open the remaining neighbours |
| Difficulty buttons | 9×9 / 12×16 / 14×20 boards |

### 2048
| Input | Action |
| --- | --- |
| Arrow keys / `WASD` | Slide the board |
| Swipe | Slide on touch screens |
| Undo | One step back |

### Snake
| Input | Action |
| --- | --- |
| Arrow keys / `WASD` | Steer |
| `Space` | Pause / resume |
| `R` | Restart |
| On-screen D-pad / swipe | Touch controls |

### Tic-Tac-Toe
| Input | Action |
| --- | --- |
| Click a cell | Place your mark |
| “Two players” | Alternate X and O on the same screen |
| Easy / Medium / Hard | Random / optimal 65 % / full minimax opponent |

### Code (editor)
| Input | Action |
| --- | --- |
| `Ctrl/Cmd + S` | Save the active file back into the virtual file system |
| `Ctrl/Cmd + F` | Open the find panel (match count, next/previous with wrap-around) |
| `Enter` / `Escape` | Jump to the next match / close the find panel |
| `Tab` / `Shift + Tab` | Indent or outdent the selection (multi-line aware) |
| `↑` `↓` / `Enter` | Explorer: move the cursor / open a file |
| Click a tab's `×` | Close the tab (with a guard when the file has unsaved changes) |
