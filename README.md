# 毛概刷题系统

基于 `W:\Download\毛概刷题.html` 工程化重构的 Vite + 原生 JavaScript + Capacitor Android 预备项目。

## 默认账号

- 账号：`admin`
- 密码：`hsx0603`

源码中不保存明文密码，只保存固定盐和 SHA-256 哈希。该方案用于避免明文暴露，不等同于服务端安全认证。

## 常用命令

```bash
npm install
npm run extract:data
npm run dev
npm run build
npm run android:sync
```
