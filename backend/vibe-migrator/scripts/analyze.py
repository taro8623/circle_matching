import os
import re

def scan_context_files():
    patterns = [
        "GEMINI.md", "MEMORY.md", "README.md", "WAKE_UP.md", "TODO.md",
        ".cursorrules", ".clinerules", ".claude/settings.local.json",
        ".github/copilot-instructions.md"
    ]
    found = []
    for root, dirs, files in os.walk("."):
        # Ignore some dirs
        if "venv" in dirs: dirs.remove("venv")
        if ".git" in dirs: dirs.remove(".git")
        if "__pycache__" in dirs: dirs.remove("__pycache__")
        
        for p in patterns:
            # Check if pattern is a file name or path
            if "/" in p:
                if os.path.exists(p):
                    if p not in found: found.append(p)
            else:
                if p in files:
                    full_path = os.path.join(root, p)
                    if full_path not in found: found.append(full_path)
    return found

def analyze_style():
    # Look at some python files to guess style
    style_info = {
        "naming": "unknown",
        "docstrings": "unknown",
        "comments_lang": "unknown"
    }
    py_files = []
    for root, dirs, files in os.walk("."):
        if "venv" in dirs: dirs.remove("venv")
        for f in files:
            if f.endswith(".py"):
                py_files.append(os.path.join(root, f))
                if len(py_files) >= 5: break
        if len(py_files) >= 5: break
    
    if not py_files:
        return style_info
    
    content = ""
    for f in py_files:
        with open(f, "r") as f_obj:
            content += f_obj.read()
    
    # Check for snake_case vs camelCase
    snake = len(re.findall(r"[a-z]+_[a-z]+", content))
    camel = len(re.findall(r"[a-z]+[A-Z][a-z]+", content))
    style_info["naming"] = "snake_case" if snake > camel else "camelCase"
    
    # Check for comment language (rough heuristic for Japanese)
    if re.search(r"[\u3040-\u30ff\u4e00-\u9faf]", content):
        style_info["comments_lang"] = "Japanese"
    else:
        style_info["comments_lang"] = "English"
        
    return style_info

if __name__ == "__main__":
    print("--- SCANNING CONTEXT FILES ---")
    files = scan_context_files()
    for f in files:
        print(f"Found: {f}")
        
    print("\n--- ANALYZING STYLE ---")
    style = analyze_style()
    for k, v in style.items():
        print(f"{k}: {v}")
