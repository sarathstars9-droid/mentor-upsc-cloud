import sys

filepath = 'c:\\Projects\\upsc-mentor-pwa\\upsc-mentor-cloud-deploy\\upsc-mentor-pwa\\backend\\server.js'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for i, line in enumerate(lines):
    if i == 1189:  # Line 1190
        new_lines.append(line)
        # Inherit the exact line ending from the file
        nl = '\r\n' if line.endswith('\r\n') else '\n'
        new_lines.append('          .map((part) => mapSinglePart(part, normalizedSubject))' + nl)
        new_lines.append('          .filter(Boolean);' + nl)
    elif i == 1214:  # Line 1215: .map(...)
        pass
    elif i == 1215:  # Line 1216: .filter(...)
        pass
    else:
        new_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
