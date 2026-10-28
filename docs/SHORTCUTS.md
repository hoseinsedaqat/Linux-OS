# Keyboard shortcuts

## Global

| Shortcut | Action |
| --- | --- |
| `Ctrl / Cmd + K` | Applications menu |
| `Ctrl + Alt + T` | Terminal |
| `Ctrl + Alt + L` | Lock session |
| `Alt + Tab` | Focus next window |
| `Esc` | Close menu / dialog / overlay |

## Window manager

| Shortcut / gesture | Action |
| --- | --- |
| Drag title bar | Move window |
| Drag to top edge | Snap preview → maximise on release |
| Double-click title bar | Toggle maximise |
| Drag any window edge/corner | Resize (eight handles) |
| Right-click title bar | Window menu (restore, snap left/right, close) |
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
