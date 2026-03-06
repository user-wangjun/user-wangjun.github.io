# 智能日历助手完整部署指南 - calendarbot.top

## 概述

本文档指导您将智能日历助手部署到 GitHub Pages 并配置自定义域名 calendarbot.top。

---

## 已完成的配置

✅ **项目构建测试通过** - 项目可以正常构建
✅ **CNAME 文件已创建** - `public/CNAME` 文件包含 `calendarbot.top`
✅ **GitHub Actions 工作流已配置** - `.github/workflows/deploy.yml`

---

## 部署步骤

### 第 1 步：在 GitHub 仓库中启用 GitHub Pages

1. 访问您的 GitHub 仓库：https://github.com/user-wangjun/user-wangjun.github.io
2. 点击 **Settings**（设置）标签
3. 在左侧菜单中找到 **Pages**（页面）
4. 在 **Build and deployment** 部分：
   - **Source**（来源）选择：**GitHub Actions**
   - 点击 **Save**（保存）

### 第 2 步：启用 GitHub Actions

1. 在仓库页面点击 **Actions**（操作）标签
2. 如果看到 "Workflows aren't being run"，点击：
   **"I understand my workflows, go ahead and enable them"**

### 第 3 步：提交并推送代码（如果尚未推送）

```bash
# 在项目根目录执行
git add public/CNAME
git commit -m "feat: 添加自定义域名配置 calendarbot.top"
git push origin main
```

### 第 4 步：配置域名 DNS 解析

登录您的域名注册商后台（如阿里云、腾讯云等），添加以下 DNS 记录：

| 记录类型 | 主机记录 | 记录值 | TTL |
|---------|---------|--------|-----|
| CNAME | @ | user-wangjun.github.io | 600 |
| CNAME | www | user-wangjun.github.io | 600 |

**或者使用 A 记录（如果 CNAME 不支持裸域名）：**

GitHub Pages 的 IP 地址（2026年最新）：
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

| 记录类型 | 主机记录 | 记录值 | TTL |
|---------|---------|--------|-----|
| A | @ | 185.199.108.153 | 600 |
| A | @ | 185.199.109.153 | 600 |
| A | @ | 185.199.110.153 | 600 |
| A | @ | 185.199.111.153 | 600 |
| CNAME | www | user-wangjun.github.io | 600 |

### 第 5 步：在 GitHub Pages 中配置自定义域名

1. 回到仓库 **Settings** → **Pages**
2. 在 **Custom domain**（自定义域名）部分：
   - 输入：`calendarbot.top`
   - 点击 **Save**
3. 勾选 **Enforce HTTPS**（强制 HTTPS）
   - 注意：DNS 生效后需要等待几分钟到几小时才能启用 HTTPS

### 第 6 步：等待部署和 DNS 生效

- **GitHub Actions 部署**：2-5 分钟
- **DNS 生效**：几分钟到 48 小时（通常 10-30 分钟）

---

## 验证部署

### 检查 GitHub Actions 部署状态

1. 访问仓库 **Actions** 标签
2. 查看最新的 "Deploy to GitHub Pages" 工作流
3. 确认状态为 ✅ **Success**

### 测试网站访问

1. 首先测试默认域名：
   - `https://user-wangjun.github.io/`

2. 然后测试自定义域名：
   - `http://calendarbot.top`
   - `https://calendarbot.top`（HTTPS 生效后）

---

## CI/CD 自动化

当前配置已支持 CI/CD：

- **自动部署**：每次推送到 `main` 分支自动触发部署
- **手动部署**：在 Actions 标签页点击 "Run workflow" 手动触发

---

## 常见问题

### Q: 部署后网站显示 404？
A: 检查以下几点：
1. 确认 `vite.config.js` 中的 `base` 配置为 `'/'`
2. 确认 GitHub Pages Source 选择的是 GitHub Actions
3. 等待 5-10 分钟让部署完成

### Q: 自定义域名无法访问？
A: 
1. 使用 `nslookup calendarbot.top` 检查 DNS 是否生效
2. 确认 DNS 记录配置正确
3. 等待 DNS 传播（最多 48 小时）

### Q: HTTPS 不生效？
A:
1. 确保 DNS 已生效
2. 在 GitHub Pages 设置中重新保存自定义域名
3. 等待 GitHub 颁发证书（最多 24 小时）

---

## 监控和维护

### 监控网站状态

推荐使用以下免费服务监控网站可用性：
- UptimeRobot
- StatusCake
- Cloudflare（如果使用 Cloudflare DNS）

### 查看部署日志

在 GitHub 仓库的 **Actions** 标签页可以查看所有部署历史和日志。

---

## 下一步

部署完成后，您可以：
1. 在网站设置中配置 API 密钥（智谱 AI、高德地图等）
2. 测试所有功能是否正常工作
3. 配置 Google Analytics 等统计工具
4. 根据需要添加自定义功能

---

**祝您部署成功！** 🎉

如有问题，请查看项目文档或提交 Issue。
