# 全球 GNSS 测站与 ADS-B 干扰地图

交互式地图包括全球 IGS 测站、Stanford ADS-B 低 NIC H3 六边形、每日异常事件中心和分级城市地名。

## 本地运行

需要 Node.js 18 或更高版本：

```bash
npm install
npm start
```

打开 `http://127.0.0.1:8765/`。

## 发布到 Render

1. 将本目录中的全部文件上传到一个 GitHub 仓库。
2. 在 Render 控制台选择 **New → Blueprint**。
3. 连接该 GitHub 仓库。Render 会自动读取 `render.yaml`。
4. 确认服务名称和 Free 方案，然后创建服务。
5. 部署完成后打开 Render 生成的 `https://*.onrender.com` 地址。

也可以选择 **New → Web Service**，配置如下：

- Build Command: `npm ci`
- Start Command: `npm start`
- Health Check Path: `/health`

## 数据说明

- 测站：IGS Network
- 干扰六边形及事件：Stanford GPS Lab RFI 数据
- 国界和城市：Natural Earth / world-atlas

日期接口由 `server.js` 代理请求 Stanford 数据。若某日数据未发布或上游服务暂时不可用，页面会显示日期加载失败。
