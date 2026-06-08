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

## 题库

当前内置原刷题题库 245 题，并追加南京工业大学历年试卷 133 题，总计 378 题。历年试卷按年份作为章节导入，可通过“历年试卷”模式或章节筛选单独练习。

重新导入历年试卷题库：

```bash
npm run import:njust
```

默认读取 `W:\Download\南京工业大学毛概历年试卷_统一格式含答案_JSON打包.zip`，也可以在脚本后传入 zip 路径。