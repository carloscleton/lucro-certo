import json
file_path = r'c:\Projeto-antigravity\src\i18n\locales\es.json'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()
    print(f"Total length: {len(text)}")
    if '"contacts"' in text:
        pos = text.find('"contacts"')
        print(f"Found 'contacts' at {pos}")
        print(f"Context: {repr(text[pos-20:pos+100])}")
    else:
        print("'contacts' not found in text")
