import sys, pathlib
d = pathlib.Path('/tmp/claude-0/x/lab3d')
design = sys.argv[1]; out = sys.argv[2]
js = '\n'.join((d / f).read_text() for f in [design, 'core.js', 'world.js', 'game.js', 'mda.js'] + (['mission.js'] if 'mission:' in (d / design).read_text() else []))
import re
nm = re.search(r"name: '([^']+)'", (d / design).read_text())
head = (d / 'head.html').read_text().replace('__TITLE__', nm.group(1) if nm else 'Игра')
pathlib.Path(out).write_text(head + '<script>\n' + js + '\n</script>\n')
print('ok', len(head + js))
