# NWU SCM Personal

西北大学后勤供应链协同平台个人版，一个用于课程/演示的静态 Web 应用。

## 内容

- 登录页与主系统界面
- 供应商、采购、库存和协同流程的前端展示
- 纯浏览器运行，无需后端服务

## 运行

直接用浏览器打开 `index.html`，或在仓库目录启动任意静态文件服务器：

```bash
python -m http.server 8000
```

然后访问 `http://localhost:8000`。

## 目录

- `index.html`：页面入口
- `assets/app.js`：界面逻辑
- `assets/scm-core.js`：供应链演示核心
- `assets/styles.css`：样式

这是课程项目/个人演示仓库，与 WOOKING 产品仓库保持独立。
