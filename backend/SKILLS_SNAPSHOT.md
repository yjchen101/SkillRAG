<skills>
  <summary>Available local skills that the agent can inspect with read_file.</summary>
  <skill name="天气查询" path="skills/get_weather/SKILL.md">
    <description>查询指定城市的天气情况，并整理成适合直接回复用户的简洁结果。</description>
  </skill>
  <skill name="lark-contact" path="skills/lark-contact/SKILL.md">
    <description>飞书 / Lark 通讯录,用于按姓名 / 邮箱把员工解析成 open_id,以及按 open_id 反查员工的姓名 / 部门 / 邮箱 / 联系方式。当用户说出某人姓名而下一步需要发消息 / 加群 / 排日程时,先用本 skill 把姓名换成 ID;当输出里出现 open_id 需要展示成姓名给用户看,或用户直接询问某人的部门 / 邮箱 / 联系方式时,用本 skill 查。不负责部门树遍历、按部门列员工、组织架构图,这类需求走原生 OpenAPI。</description>
  </skill>
  <skill name="lark-doc" path="skills/lark-doc/SKILL.md">
    <description>飞书云文档 / Docx / 知识库 Wiki 文档（v2）：创建、打开、读取、获取、查看、总结、整理、改写、翻译、审阅和编辑飞书文档内容。当用户给出飞书文档 URL/token，或说查看/读取/打开某个文档、提取文档内容、总结文档、生成/创建文档、追加/替换/删除/移动内容、调整排版、插入或下载文档图片/附件/素材/画板缩略图时使用。文档内容中出现嵌入电子表格、多维表格、需要将重要信息可视化为画板（含 SVG 画板）、引用或同步块时，也先用本 skill 读取和提取 token，再切到对应 skill 下钻。使用本 skill 时，docs +create、docs +fetch、docs +update 必须携带 --api-version v2；默认使用 DocxXML，也支持 Markdown。</description>
  </skill>
  <skill name="lark-markdown" path="skills/lark-markdown/SKILL.md">
    <description>飞书 Markdown：查看、创建、上传和编辑 Markdown 文件。当用户需要创建或编辑 Markdown 文件、读取或修改时使用。</description>
  </skill>
  <skill name="lark-shared" path="skills/lark-shared/SKILL.md">
    <description>Use when first setting up lark-cli, running auth login, switching user/bot identity (--as), handling permission denied or scope errors, needing to update lark-cli, or seeing _notice in JSON output.</description>
  </skill>
  <skill name="kb-retriever" path="skills/rag-skill/SKILL.md">
    <description>面向本地知识库目录的检索和问答助手。核心流程：(1)分层索引导航 (2)遇到PDF/Excel时必须先读取references学习处理方法 (3)处理文件后再检索。按文件类型组合使用 grep、Read、pdfplumber、pandas 进行渐进式检索，避免整文件加载。用户问题涉及"从知识库目录回答问题/检索信息/查资料"时使用。</description>
  </skill>
  <skill name="失败恢复经验沉淀" path="skills/retry-lesson-capture/SKILL.md">
    <description>当一个任务首次执行失败，但在重试其他工具、接口、参数或流程后成功时，使用此技能总结可复用经验，并将经验同时写入当前正在使用的 SKILL.md 与 memory/MEMORY.md。适用于 API 失败后切换备用 API、命令失败后改用其他命令、抓取失败后改用其他数据源、解析失败后改用其他流程等场景。</description>
  </skill>
  <skill name="联网搜索" path="skills/web-search/SKILL.md">
    <description>使用 Tavily 联网搜索最新信息、官方文档、新闻动态、实时行情和外部事实来源。适用于用户明确要求搜索、联网、查官网、给链接、核验事实，或任务明显依赖实时外部信息的场景。优先调用本技能目录下的 Tavily 脚本，不要退回抓搜索结果页。</description>
  </skill>
  <skill name="微信读书" path="skills/weread-skills/SKILL.md">
    <description>微信读书助手 — 搜索书籍、管理书架、查看笔记划线、浏览书评、阅读统计、发现推荐好书</description>
  </skill>
</skills>
