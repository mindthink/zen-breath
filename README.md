# zen-breath 🧘

Claude Code 里的冥想呼吸面板。输入 `/meditate`，终端侧边弹出一尊 ASCII 佛祖，
跟着节奏敲木鱼带你呼吸；结束后记录累计次数与连续天数。

```
 🧘 方箱呼吸 4-4-4-4                              剩余 04:32

         _ooOoo_
        o8888888o
        88" . "88
        (| ^_^ |)                 ((( 咚
        O\  =  /O                    o
     ____/`---'\____               ,--.
   .'  \\|     |//  `.            (____)
  /  \\|||  :  |||//  \
 /  _||||| -:- |||||_  \
 |   | \\\  -  /// |   |
 | \_|  ''\---/''  |   |
 \  .-\__  `-`  ___/-. /
  `-.________________.-'
         `=---='

 吸气 · 3                                         敲了 7 下

 [p 暂停]  [m 换模式]  [q 结束]

 累计 12 次 · 58 分钟 · 连续 4 天
```

## 功能

- 三种呼吸模式：方箱呼吸 4-4-4-4、放松呼吸 4-7-8、平静呼吸 5-5
- 每进入一个呼吸阶段木鱼敲一下，佛祖眯眼微笑
- 面板里 `p` 暂停 / 继续、`m` 切换模式、`q` 结束；关掉面板即结束
- 进度同步显示在状态栏，终端太窄放不下面板时也能用
- 完成后弹出 toast，累计次数、分钟数和连续天数跨会话保存

## 安装

### 方式一：作为 marketplace 安装（推荐）

```bash
claude plugin marketplace add mindthink/zen-breath
claude plugin install zen-breath@zen-breath
```

### 方式二：本地目录加载

```bash
git clone https://github.com/mindthink/zen-breath.git ~/.claude/mods/zen-breath
claude --plugin-dir ~/.claude/mods/zen-breath
```

想每次启动都自动加载（包括桌面端），在 `~/.claude/settings.json` 里加：

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/zen-breath"
  }
}
```

## 用法

```
/meditate                 # 默认 5 分钟，沿用上次的模式
/meditate 10              # 10 分钟
/meditate 3 relax         # 3 分钟 4-7-8 放松呼吸
/meditate calm            # 5 分钟平静呼吸
/meditate stats           # 查看累计记录
/meditate stop            # 结束当前冥想
```

模式参数：`box`（方箱 4-4-4-4）、`relax`（放松 4-7-8）、`calm`（平静 5-5）。时长 1 到 120 分钟。

## 开发

这是一个 Claude Code hooks mod（function hooks 插件），不依赖 Node，整个逻辑在
`hooks/register.tsx` 一个文件里。

```bash
claude plugin validate .      # 校验清单和 hooks 模块
claude plugin test .          # 跑 tests/ 里的测试
claude --plugin-dir .         # 在交互会话里加载，保存文件即热重载
```

`.claude-plugin/types/` 下的类型声明由 Claude Code 在加载 mod 时自动生成，
不入库；加载过一次后 `tsc -p .` 即可做类型检查。

目录结构：

```
.claude-plugin/plugin.json      插件清单
.claude-plugin/marketplace.json 让本仓库可直接作为 marketplace 安装
hooks/hooks.json                指向 hooks 模块
hooks/register.tsx              命令、计时器、面板渲染
types/index.d.ts                $.state 的类型契约（Session / Stats）
tests/zen-breath.test.ts        倒计时、暂停、切模式、参数校验的测试
```

## License

[MIT](./LICENSE)
