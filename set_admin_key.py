"""设置 G3D 管理员密钥 — 用法: python set_admin_key.py"""
import hashlib
import os
import re
import sys

APP_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "app.py")


def _read_salt() -> str:
    with open(APP_PATH, "r", encoding="utf-8") as f:
        content = f.read()
    m = re.search(r'_ADMIN_SALT\s*=\s*"([^"]+)"', content)
    if not m:
        print("❌ 无法从 app.py 读取 _ADMIN_SALT")
        sys.exit(1)
    return m.group(1)


def hash_key(key: str, salt: str) -> str:
    return hashlib.sha256((key + salt).encode()).hexdigest()


def main():
    print("=" * 50)
    print("  设置 G3D 管理员密钥")
    print("=" * 50)
    salt = _read_salt()
    key = input("请输入新密钥: ").strip()
    if not key:
        print("❌ 密钥不能为空")
        sys.exit(1)
    confirm = input("请再次输入新密钥: ").strip()
    if key != confirm:
        print("❌ 两次输入不一致")
        sys.exit(1)

    new_hash = hash_key(key, salt)

    with open(APP_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = r'_ADMIN_KEY_HASH\s*=\s*"[a-f0-9]+"'
    match = re.search(pattern, content)
    if not match:
        print("❌ 无法找到 _ADMIN_KEY_HASH 配置行，请手动修改")
        print(f"   新哈希值: {new_hash}")
        sys.exit(1)

    old_line = match.group(0)
    new_line = f'_ADMIN_KEY_HASH = "{new_hash}"'
    content = content.replace(old_line, new_line)

    with open(APP_PATH, "w", encoding="utf-8") as f:
        f.write(content)

    print(f"✅ 管理员密钥已更新")
    print(f"   新哈希值: {new_hash}")


if __name__ == "__main__":
    main()