# MCP (Model Context Protocol) 專案

這個專案提供了一個與 Open WebUI 整合的 MCP 服務器實現。

## 使用工具

- macOS
- Python 3.11+
- Pyenv
- Poetry
- Node.js 22+
- Ollama
## 安裝步驟

### 1. 安裝 Pyenv

```bash
# 使用 Homebrew 安裝 pyenv
brew install pyenv

# 將 pyenv 初始化加入 shell
echo 'eval "$(pyenv init --path)"' >> ~/.zshrc
echo 'eval "$(pyenv init -)"' >> ~/.zshrc
source ~/.zshrc

# 安裝 Python 3.10
pyenv install 3.10.13
```

### 2. 安裝 Poetry

```bash
curl -sSL https://install.python-poetry.org | python3 -
```

將 Poetry 加入環境變數：
```bash
echo 'export PATH="/Users/$USER/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

安裝poetry-plugin-shell
```bash
poetry self add poetry-plugin-shell
```

### 3. 專案設定

```bash
# 切換到專案目錄
cd mcp

# 設定專案的 Python 版本
pyenv local 3.12

# 初始化 Poetry 專案
poetry init

# 安裝依賴
poetry install
```

### 4. 環境設定

建立 `.env` 檔案：

```env
ANTHROPIC_API_KEY=your_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```

## 啟動服務

### 進入poetry

```bash
### 啟動poetry虛擬環境
poetry env activate

### 啟動 Open WebUI
open-webui serve
### 此時終端機指令將會傳送至poetry虛擬環境
###close poetry 
exit()

#go http://localhost:8080
```

## 專案結構

```
mcp/
├── pyproject.toml    # Poetry 配置文件
├── poetry.lock       # Poetry 鎖定文件
├── .python-version   # Pyenv 版本文件
├── .env             # 環境變數
├── server/          # 服務器源碼
│   └── __init__.py
├── client/          # 客戶端源碼
│   └── __init__.py
└── README.md        # 專案文檔
```

## 開發工具設定

### VS Code 設定

在 `.vscode/settings.json` 中添加：

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/.venv/bin/python",
  "python.formatting.provider": "black",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true
}
```

## 故障排除

如果遇到 Poetry 相關問題：

1. 確保 Poetry 已正確安裝：
```bash
poetry --version
```

2. 重新建立虛擬環境：
```bash
poetry env remove python
poetry install
```

3. 更新依賴：
```bash
poetry update
```

## 相關資源

- [Open WebUI 文檔](https://github.com/open-webui/open-webui)
- [Poetry 文檔](https://python-poetry.org/docs/)
- [Pyenv 文檔](https://github.com/pyenv/pyenv)
- [Open WebUI + Ollama](https://docs.openwebui.com/getting-started/quick-start/starting-with-ollama)