// ───────────────────────────────────────────
// UI strings dictionary (frontend-only)
// Product content (name/description/audience) lives in DB as LangMap — NOT here.
// These are chrome/CTA/button strings.
// ───────────────────────────────────────────

import type { Lang } from '@asb/shared';

export interface UiStrings {
  // Input surface
  inputPlaceholder: string;
  inputHint: string;
  generateButton: string;
  generating: string;
  micStart: string;
  micStop: string;
  micListening: string;
  micTranscribing: string;
  // Quick scenarios
  quickScenariosTitle: string;
  quickScenarioTemplate: (role: string, industry: string, challenge: string) => string;
  // Recommendation
  recommendationsTitle: string;
  /** Subtitle under the recommendations title showing actually-used model + latency.
   *  Args: model name (e.g. "gemini-2.5-pro"), latency in seconds (e.g. "1.2"). */
  recommendationsBy: (model: string, seconds: string) => string;
  /** Status text rotation during loading skeleton (3 phases of ~0.9s each):
   *  phase1 = analysing input, phase2 = matching products, phase3 = generating rationale. */
  recommendationsLoadingPhase1: string;
  recommendationsLoadingPhase2: string;
  recommendationsLoadingPhase3: string;
  rationaleLabel: string;
  rationaleExpand: string;
  rationaleCollapse: string;
  productCtaLearnMore: string;
  // Product bottom list
  allProductsTitle: string;
  // Errors
  errorLlmRequired: string;
  errorLlmCallFailed: string;
  errorAiInvalid: string;
  errorNetwork: string;
  errorGeneric: string;
  retry: string;
  // Offline fallback banner
  offlineBannerTitle: string;
  offlineBannerHint: string;
  // Admin
  adminTitle: string;
  adminLoginTitle: string;
  adminLoginInviteHint: string;
  adminLoginOtpLabel: string;
  adminLoginOtpSend: string;
  adminLoginOtpSending: string;
  adminLoginOtpSent: string; // contains {email}
  adminLoginOtpNotInvited: string;
  adminLoginOtpRateLimit: string;
  adminLoginOr: string;
  adminLoginDomainWarning: string; // contains {domain}
  adminSignInWithGoogle: string;
  adminSigningIn: string;
  adminNotWhitelistedTitle: string;
  adminNotWhitelistedHint: string;
  adminSwitchAccount: string;
  adminLogout: string;
  adminBrandSwitchTitle: string;
  adminProductsTitle: string;
  /** Lead-in copy for editors: counts of own vs platform products. {my} {platform} placeholders. */
  adminProductsEditorHint: string;
  /** Badge on rows the editor owns (editable). */
  adminProductBadgeMine: string;
  /** Badge on platform-seeded rows shown to editors as read-only reference. */
  adminProductBadgePlatform: string;
  /** ARIA + tooltip text for the expand chevron (collapsed → click to open). */
  adminProductExpand: string;
  /** ARIA + tooltip text for the expand chevron (expanded → click to close). */
  adminProductCollapse: string;
  /** Editor onboarding tour heading shown above the products list. */
  adminEditorTourTitle: string;
  /** Editor onboarding tour step 1 — identity strip. */
  adminEditorTourStep1: string;
  /** Editor onboarding tour step 2 — platform reference vs yours. */
  adminEditorTourStep2: string;
  /** Editor onboarding tour step 3 — clone-as-template / new product. */
  adminEditorTourStep3: string;
  /** Editor onboarding tour step 4 — expand row to see full info. */
  adminEditorTourStep4: string;
  /** ARIA label / tooltip for the X button that dismisses the tour. */
  adminEditorTourDismiss: string;
  adminAddProduct: string;
  adminEditProduct: string;
  adminDeleteProduct: string;
  adminConfirmDelete: string;
  adminSave: string;
  adminCancel: string;
  /** Inline meta below the EN name input on create — shows the auto-derived
   *  short code so editors see what AI prompts will reference. {id} placeholder. */
  adminFieldEnNameHint: string;
  /** Inline meta when EN name is empty — explains why save is disabled. */
  adminFieldEnNameHintEmpty: string;
  /** Inline error when the auto-derived code collides with an existing product. {id} placeholder. */
  adminFieldEnNameCollision: string;
  /** Banner next to the disabled Save button when editor never filled EN name. */
  adminFieldEnNameRequired: string;
  adminFieldName: string;
  adminFieldDescription: string;
  adminFieldAudience: string;
  adminFieldUrl: string;
  adminFieldParticipating: string;
  adminSaved: string;
  adminProductOwner: string;
  adminProductUnowned: string;
  adminProductClone: string;
  adminProductCloned: string;
  adminProductPublished: string;
  adminProductUnpublished: string;
  // Admin users panel (super_admin)
  adminUsersTitle: string;
  adminUsersInviteEmail: string;
  adminUsersInviteRole: string;
  adminUsersInviteButton: string;
  adminUsersRevokeButton: string;
  adminUsersRoleEditor: string;
  adminUsersRoleSuperAdmin: string;
  adminUsersStatusActivated: string;
  adminUsersStatusPending: string;
  // Quick scenarios admin panel
  adminQuickScenariosTitle: string;
  adminQuickScenariosHint: string;
  adminQuickScenariosUnsaved: string;
  adminQuickScenariosReset: string;
  adminQuickScenariosResetConfirm: string;
  adminQuickScenariosFieldRole: string;
  adminQuickScenariosFieldRolePlaceholder: string;
  adminQuickScenariosFieldIndustry: string;
  adminQuickScenariosFieldIndustryPlaceholder: string;
  adminQuickScenariosFieldChallenge: string;
  adminQuickScenariosFieldChallengePlaceholder: string;
  /** Label for the product-tag chip row. */
  adminQuickScenariosFieldProducts: string;
  /** Shown when there are zero participating products to tag. */
  adminQuickScenariosNoProducts: string;
  /** Coverage banner when every active product has at least one scenario.
   *  Args: {covered}, {total}, {lang} */
  adminQuickScenariosCoverageOk: string;
  /** Coverage banner when some products are not tagged by any scenario.
   *  Args: {covered}, {total}, {lang}, {missing} (comma-separated IDs) */
  adminQuickScenariosCoverageMissing: string;
  adminQuickScenariosAdd: string;
  adminQuickScenariosEmpty: string;
  adminQuickScenariosMaxReached: string;
  /** @deprecated kept until cleanup; replaced by adminUsersInviteLink* below. */
  adminUsersInviteEmailSent: string;
  /** @deprecated */
  adminUsersInviteEmailSkipped: string;
  /** Toast title when inviteLink is ready (use {email} placeholder). */
  adminUsersInviteLinkReady: string;
  /** Toast title when APP_URL was unset and we couldn't generate a link. */
  adminUsersInviteLinkSkipped: string;
  /** Helper text under the link prompting super_admin to share via Lark/WeChat.
   *  IMPORTANT: text mentions "14 days". If you change the Supabase project's
   *  Email OTP Expiration setting (Authentication → Providers → Email), update
   *  this string in all 4 langs to match. Otherwise the UI lies to users. */
  adminUsersInviteLinkHint: string;
  /** Button: copy link to clipboard. */
  adminUsersInviteLinkCopy: string;
  /** Button label after a successful copy (transient, ~2s). */
  adminUsersInviteLinkCopied: string;
  // Lang labels (in own lang)
  langLabels: Record<Lang, string>;
}

const common = {
  langLabels: {
    'zh-CN': '简中',
    'zh-HK': '繁中',
    en: 'EN',
    ja: '日本語',
  } as Record<Lang, string>,
};

export const TRANSLATIONS: Record<Lang, UiStrings> = {
  'zh-CN': {
    inputPlaceholder: '我是跨国制造业的CFO，跨国团队差旅报销混乱，财务对账困难……',
    inputHint: '描述你的业务痛点，AI 会推荐 3 个最合适的系统',
    generateButton: '开始推荐',
    generating: '生成中…',
    micStart: '语音输入',
    micStop: '停止录音',
    micListening: '聆听中…',
    micTranscribing: '转写中…',
    quickScenariosTitle: '快速场景',
    quickScenarioTemplate: (role, industry, challenge) =>
      `我是${industry}的${role}。${challenge}`,
    recommendationsTitle: 'AI 推荐方案',
    recommendationsBy: (model, seconds) => `由 ${model} 生成 · ${seconds}s`,
    recommendationsLoadingPhase1: '正在分析您的痛点…',
    recommendationsLoadingPhase2: '匹配候选产品…',
    recommendationsLoadingPhase3: '生成推荐理由…',
    rationaleLabel: '为什么推荐：',
    rationaleExpand: '展开详情',
    rationaleCollapse: '收起',
    productCtaLearnMore: '了解更多 →',
    allProductsTitle: '全部产品',
    errorLlmRequired: 'AI 密钥未配置，请联系管理员。',
    errorLlmCallFailed: 'AI 调用失败，请稍后重试。',
    errorAiInvalid: 'AI 返回数据异常，请重试。',
    errorNetwork: '网络异常，请检查连接。',
    errorGeneric: '出错了，请重试。',
    retry: '重试',
    offlineBannerTitle: '离线模式',
    offlineBannerHint: '网络不可用，正在展示本地缓存的产品。AI 推荐暂不可用。',
    adminTitle: '管理台',
    adminLoginTitle: '管理员登录',
    adminLoginInviteHint: '从邀请邮件点链接应自动进入管理台。如看到此页，说明链接已失效（QQ/163 等邮箱的安全扫描会预取链接），在下方重新申请一封即可。',
    adminLoginOtpLabel: '邮箱',
    adminLoginOtpSend: '发送登录链接',
    adminLoginOtpSending: '发送中…',
    adminLoginOtpSent: '登录链接已发送至 {email}。邮件可能需 1–2 分钟到达，请查收（也看看垃圾邮件）。',
    adminLoginOtpNotInvited: '此邮箱未被邀请。请联系 super_admin 将你加入授权名单后再试。',
    adminLoginOtpRateLimit: '发送过于频繁，请等 1 分钟后重试。',
    adminLoginOr: '或',
    adminLoginDomainWarning: '检测到 {domain} 邮箱——此类邮箱的安全扫描经常预取链接致失效。建议改用 Gmail / 公司 Workspace 邮箱；若仍想用此邮箱，收到邮件后请立刻用手机端 App 点链接（桌面端扫描更严）。',
    adminSignInWithGoogle: '使用 Google 账号登录',
    adminSigningIn: '登录中…',
    adminNotWhitelistedTitle: '账号未授权',
    adminNotWhitelistedHint: '你的邮箱未在白名单里。请联系 super_admin 添加后再登录。',
    adminSwitchAccount: '切换账号',
    adminLogout: '退出',
    adminBrandSwitchTitle: '品牌切换',
    adminProductsTitle: '产品管理',
    adminProductsEditorHint: '我的产品 {my} 个 · 平台参考 {platform} 个（仅查看，不可编辑）',
    adminProductBadgeMine: '我的',
    adminProductBadgePlatform: '平台',
    adminProductExpand: '展开详情',
    adminProductCollapse: '收起',
    adminEditorTourTitle: '👋 第一次进来？快速上手',
    adminEditorTourStep1: '左上能看到你的邮箱和角色（编辑者）',
    adminEditorTourStep2: '标「平台」的是参考模板，仅查看；标「我的」的可以随时改',
    adminEditorTourStep3: '想试试？点任意行的「复制」即可基于平台模板建一份你的副本，再按右上「+ 新增产品」改名定制',
    adminEditorTourStep4: '点每行右侧 ⌄ 可展开看完整描述、适用人群和落地页 URL',
    adminEditorTourDismiss: '不再显示',
    adminAddProduct: '新增产品',
    adminEditProduct: '编辑',
    adminDeleteProduct: '删除',
    adminConfirmDelete: '确定删除此产品？',
    adminSave: '保存',
    adminCancel: '取消',
    adminFieldEnNameHint: '保存后系统将以代号 "{id}" 作为此产品的内部引用（AI 推荐和日志）。',
    adminFieldEnNameHintEmpty: '请输入英文名称（必填，作为产品唯一标识）。',
    adminFieldEnNameCollision: '已有产品的英文名称对应同样代号 "{id}"，请改个名称区分开。',
    adminFieldEnNameRequired: '请在 EN tab 填写英文名称才能保存',
    adminFieldName: '名称',
    adminFieldDescription: '描述',
    adminFieldAudience: '适用人群',
    adminFieldUrl: '落地页 URL',
    adminFieldParticipating: '参与推荐',
    adminSaved: '已保存',
    adminProductOwner: '所有者',
    adminProductUnowned: '无主（孤儿池）',
    adminProductClone: '克隆',
    adminProductCloned: '已克隆',
    adminProductPublished: '已上线',
    adminProductUnpublished: '已下线',
    adminUsersTitle: '授权用户',
    adminUsersInviteEmail: '邮箱',
    adminUsersInviteRole: '角色',
    adminUsersInviteButton: '邀请',
    adminUsersRevokeButton: '移除',
    adminUsersRoleEditor: '编辑者',
    adminUsersRoleSuperAdmin: '超级管理员',
    adminUsersStatusActivated: '已激活',
    adminUsersStatusPending: '待首次登录',
    adminQuickScenariosTitle: '快速场景',
    adminQuickScenariosHint: '首页底部展示给观众的预设场景。讲师在嘈杂场地或语音失效时一键触发推荐。改完点保存立即生效，无需部署。',
    adminQuickScenariosUnsaved: '有未保存的修改',
    adminQuickScenariosReset: '恢复默认',
    adminQuickScenariosResetConfirm: '确定恢复为内置默认场景？当前所有自定义场景将被清空。',
    adminQuickScenariosFieldRole: '角色',
    adminQuickScenariosFieldRolePlaceholder: '销售VP',
    adminQuickScenariosFieldIndustry: '行业',
    adminQuickScenariosFieldIndustryPlaceholder: '科技公司',
    adminQuickScenariosFieldChallenge: '痛点',
    adminQuickScenariosFieldChallengePlaceholder: '销售与法务协作慢，合同审批周期长。',
    adminQuickScenariosFieldProducts: '主要演示产品（标记，不影响 AI 推荐）',
    adminQuickScenariosNoProducts: '当前没有参与推荐的产品。',
    adminQuickScenariosCoverageOk: '✓ {lang} 下 {covered}/{total} 个参与产品都有场景覆盖',
    adminQuickScenariosCoverageMissing: '{lang} 下 {covered}/{total} 个参与产品有场景覆盖。未覆盖：{missing}（建议加场景或调整标记）',
    adminQuickScenariosAdd: '添加场景',
    adminQuickScenariosEmpty: '此语言暂无场景，点下方添加',
    adminQuickScenariosMaxReached: '已达上限 (20)',
    adminUsersInviteEmailSent: '已发送邀请邮件，对方点邮件里的链接即可登录。',
    adminUsersInviteEmailSkipped: '已加入白名单。请手动通知对方用 Google 账号登录。',
    adminUsersInviteLinkReady: '已为 {email} 生成邀请链接，复制后通过飞书/微信/短信发给对方即可登录。',
    adminUsersInviteLinkSkipped: '已为 {email} 加入白名单。当前环境未生成链接，请通知对方用 Google 账号登录。',
    adminUsersInviteLinkHint: '链接 14 天有效，一次性使用，被点击后立即失效。请通过私密渠道发送（飞书 / 微信 / 短信）。',
    adminUsersInviteLinkCopy: '复制链接',
    adminUsersInviteLinkCopied: '已复制',
    ...common,
  },
  'zh-HK': {
    inputPlaceholder: '我是跨國製造業的CFO，跨國團隊差旅報銷混亂，財務對賬困難……',
    inputHint: '描述你的業務痛點，AI 會推薦 3 個最合適的系統',
    generateButton: '開始推薦',
    generating: '生成中…',
    micStart: '語音輸入',
    micStop: '停止錄音',
    micListening: '聆聽中…',
    micTranscribing: '轉寫中…',
    quickScenariosTitle: '快速場景',
    quickScenarioTemplate: (role, industry, challenge) =>
      `我是${industry}的${role}。${challenge}`,
    recommendationsTitle: 'AI 推薦方案',
    recommendationsBy: (model, seconds) => `由 ${model} 生成 · ${seconds}s`,
    recommendationsLoadingPhase1: '正在分析您的痛點…',
    recommendationsLoadingPhase2: '匹配候選產品…',
    recommendationsLoadingPhase3: '生成推薦理由…',
    rationaleLabel: '為什麼推薦：',
    rationaleExpand: '展開詳情',
    rationaleCollapse: '收起',
    productCtaLearnMore: '了解更多 →',
    allProductsTitle: '全部產品',
    errorLlmRequired: 'AI 密鑰未配置，請聯繫管理員。',
    errorLlmCallFailed: 'AI 調用失敗，請稍後重試。',
    errorAiInvalid: 'AI 返回數據異常，請重試。',
    errorNetwork: '網絡異常，請檢查連接。',
    errorGeneric: '出錯了，請重試。',
    offlineBannerTitle: '離線模式',
    offlineBannerHint: '網絡不可用，正在展示本地快取的產品。AI 推薦暫不可用。',
    retry: '重試',
    adminTitle: '管理台',
    adminLoginTitle: '管理員登錄',
    adminLoginInviteHint: '從邀請郵件點連結應自動進入管理台。如看到此頁，說明連結已失效（QQ/163 等郵箱的安全掃描會預取連結），在下方重新申請一封即可。',
    adminLoginOtpLabel: '郵箱',
    adminLoginOtpSend: '發送登錄連結',
    adminLoginOtpSending: '發送中…',
    adminLoginOtpSent: '登錄連結已發送至 {email}。郵件可能需 1–2 分鐘到達，請查收（也看看垃圾郵件）。',
    adminLoginOtpNotInvited: '此郵箱未被邀請。請聯繫 super_admin 將你加入授權名單後再試。',
    adminLoginOtpRateLimit: '發送過於頻繁，請等 1 分鐘後重試。',
    adminLoginOr: '或',
    adminLoginDomainWarning: '檢測到 {domain} 郵箱——此類郵箱的安全掃描經常預取連結致失效。建議改用 Gmail / 公司 Workspace 郵箱；若仍想用此郵箱，收到郵件後請立刻用手機端 App 點連結（桌面端掃描更嚴）。',
    adminSignInWithGoogle: '使用 Google 帳號登錄',
    adminSigningIn: '登錄中…',
    adminNotWhitelistedTitle: '帳號未授權',
    adminNotWhitelistedHint: '你的郵箱未在白名單內。請聯絡 super_admin 新增後再登錄。',
    adminSwitchAccount: '切換帳號',
    adminLogout: '退出',
    adminBrandSwitchTitle: '品牌切換',
    adminProductsTitle: '產品管理',
    adminProductsEditorHint: '我的產品 {my} 個 · 平台參考 {platform} 個（僅檢視，不可編輯）',
    adminProductBadgeMine: '我的',
    adminProductBadgePlatform: '平台',
    adminProductExpand: '展開詳情',
    adminProductCollapse: '收起',
    adminEditorTourTitle: '👋 第一次進來？快速上手',
    adminEditorTourStep1: '左上能看到你的郵箱和角色（編輯者）',
    adminEditorTourStep2: '標「平台」的是參考模板，僅檢視；標「我的」的可以隨時改',
    adminEditorTourStep3: '想試試？點任意行的「複製」即可基於平台模板建一份你的副本，再按右上「+ 新增產品」改名訂製',
    adminEditorTourStep4: '點每行右側 ⌄ 可展開看完整描述、適用人群和落地頁 URL',
    adminEditorTourDismiss: '不再顯示',
    adminAddProduct: '新增產品',
    adminEditProduct: '編輯',
    adminDeleteProduct: '刪除',
    adminConfirmDelete: '確定刪除此產品？',
    adminSave: '保存',
    adminCancel: '取消',
    adminFieldEnNameHint: '保存後系統將以代號 "{id}" 作為此產品的內部引用（AI 推薦和日誌）。',
    adminFieldEnNameHintEmpty: '請輸入英文名稱（必填，作為產品唯一識別）。',
    adminFieldEnNameCollision: '已有產品的英文名稱對應相同代號 "{id}"，請改個名稱區分開。',
    adminFieldEnNameRequired: '請在 EN tab 填寫英文名稱才能保存',
    adminFieldName: '名稱',
    adminFieldDescription: '描述',
    adminFieldAudience: '適用人群',
    adminFieldUrl: '落地頁 URL',
    adminFieldParticipating: '參與推薦',
    adminSaved: '已保存',
    adminProductOwner: '擁有者',
    adminProductUnowned: '無主（孤兒池）',
    adminProductClone: '複製',
    adminProductCloned: '已複製',
    adminProductPublished: '已上線',
    adminProductUnpublished: '已下線',
    adminUsersTitle: '授權用戶',
    adminUsersInviteEmail: '郵箱',
    adminUsersInviteRole: '角色',
    adminUsersInviteButton: '邀請',
    adminUsersRevokeButton: '移除',
    adminUsersRoleEditor: '編輯者',
    adminUsersRoleSuperAdmin: '超級管理員',
    adminUsersStatusActivated: '已激活',
    adminUsersStatusPending: '待首次登錄',
    adminQuickScenariosTitle: '快速場景',
    adminQuickScenariosHint: '首頁底部展示給觀眾的預設場景。講師在嘈雜場地或語音失效時一鍵觸發推薦。改完點保存立即生效，無需部署。',
    adminQuickScenariosUnsaved: '有未保存的修改',
    adminQuickScenariosReset: '還原預設',
    adminQuickScenariosResetConfirm: '確定還原為內建預設場景？目前所有自訂場景將被清空。',
    adminQuickScenariosFieldRole: '角色',
    adminQuickScenariosFieldRolePlaceholder: '銷售VP',
    adminQuickScenariosFieldIndustry: '行業',
    adminQuickScenariosFieldIndustryPlaceholder: '科技公司',
    adminQuickScenariosFieldChallenge: '痛點',
    adminQuickScenariosFieldChallengePlaceholder: '銷售與法務協作慢，合同審批週期長。',
    adminQuickScenariosFieldProducts: '主要演示產品（標記，不影響 AI 推薦）',
    adminQuickScenariosNoProducts: '目前沒有參與推薦的產品。',
    adminQuickScenariosCoverageOk: '✓ {lang} 下 {covered}/{total} 個參與產品都有場景覆蓋',
    adminQuickScenariosCoverageMissing: '{lang} 下 {covered}/{total} 個參與產品有場景覆蓋。未覆蓋：{missing}（建議加場景或調整標記）',
    adminQuickScenariosAdd: '加入場景',
    adminQuickScenariosEmpty: '此語言暫無場景，點下方加入',
    adminQuickScenariosMaxReached: '已達上限 (20)',
    adminUsersInviteEmailSent: '已發送邀請郵件，對方點郵件中的連結即可登錄。',
    adminUsersInviteEmailSkipped: '已加入白名單。請手動通知對方用 Google 帳號登錄。',
    adminUsersInviteLinkReady: '已為 {email} 生成邀請連結，複製後透過飛書／微信／簡訊發給對方即可登錄。',
    adminUsersInviteLinkSkipped: '已為 {email} 加入白名單。目前環境未產生連結，請通知對方用 Google 帳號登錄。',
    adminUsersInviteLinkHint: '連結 14 天有效，一次性使用，被點擊後立即失效。請透過私密渠道發送（飛書／微信／簡訊）。',
    adminUsersInviteLinkCopy: '複製連結',
    adminUsersInviteLinkCopied: '已複製',
    ...common,
  },
  en: {
    inputPlaceholder: "I'm the CFO of a multinational manufacturer — cross-border expenses are chaotic…",
    inputHint: 'Describe your business pain points. AI will recommend 3 best-fit systems.',
    generateButton: 'Generate',
    generating: 'Generating…',
    micStart: 'Voice input',
    micStop: 'Stop',
    micListening: 'Listening…',
    micTranscribing: 'Transcribing…',
    quickScenariosTitle: 'Quick scenarios',
    quickScenarioTemplate: (role, industry, challenge) =>
      `I'm a ${role} at a ${industry} company. ${challenge}`,
    recommendationsTitle: 'AI recommendations',
    recommendationsBy: (model, seconds) => `Generated by ${model} · ${seconds}s`,
    recommendationsLoadingPhase1: 'Analysing your challenge…',
    recommendationsLoadingPhase2: 'Matching candidate products…',
    recommendationsLoadingPhase3: 'Generating recommendations…',
    rationaleLabel: 'Why this fits: ',
    rationaleExpand: 'Show more',
    rationaleCollapse: 'Show less',
    productCtaLearnMore: 'Learn more →',
    allProductsTitle: 'All products',
    errorLlmRequired: 'AI key not configured. Please contact the administrator.',
    errorLlmCallFailed: 'AI call failed. Please try again.',
    errorAiInvalid: 'AI returned invalid data. Please retry.',
    errorNetwork: 'Network error. Please check your connection.',
    errorGeneric: 'Something went wrong. Please retry.',
    offlineBannerTitle: 'Offline mode',
    offlineBannerHint: 'Network is unreachable — showing cached products. AI recommendations are unavailable.',
    retry: 'Retry',
    adminTitle: 'Admin',
    adminLoginTitle: 'Admin login',
    adminLoginInviteHint: 'Clicking the invite email link should log you in automatically. If you see this page, the link was likely consumed by your email client — request a fresh one below.',
    adminLoginOtpLabel: 'Email',
    adminLoginOtpSend: 'Send login link',
    adminLoginOtpSending: 'Sending…',
    adminLoginOtpSent: 'A login link was sent to {email}. It may take 1–2 minutes (check spam too).',
    adminLoginOtpNotInvited: 'This email is not on the allow-list. Ask a super_admin to invite you first.',
    adminLoginOtpRateLimit: 'Too many requests. Please wait ~1 minute and try again.',
    adminLoginOr: 'OR',
    adminLoginDomainWarning: '{domain} emails often pre-fetch links and invalidate them. Prefer Gmail / Workspace — or on mobile, tap the link immediately in the app (desktop scanners are stricter).',
    adminSignInWithGoogle: 'Sign in with Google',
    adminSigningIn: 'Signing in…',
    adminNotWhitelistedTitle: 'Account not authorized',
    adminNotWhitelistedHint: 'Your email is not on the allow-list. Ask a super_admin to invite you, then try again.',
    adminSwitchAccount: 'Switch account',
    adminLogout: 'Log out',
    adminBrandSwitchTitle: 'Brand',
    adminProductsTitle: 'Products',
    adminProductsEditorHint: '{my} of yours · {platform} platform reference (read-only)',
    adminProductBadgeMine: 'Yours',
    adminProductBadgePlatform: 'Platform',
    adminProductExpand: 'Show full details',
    adminProductCollapse: 'Collapse',
    adminEditorTourTitle: '👋 New here? Quick tour',
    adminEditorTourStep1: 'Your email + role badge live in the top-left header',
    adminEditorTourStep2: 'Rows badged "Platform" are read-only references; "Yours" rows you can edit any time',
    adminEditorTourStep3: 'Want to try? Click "Copy" on any row to spin up your own variant of a platform template, then "+ Add product" in the top-right for a blank one',
    adminEditorTourStep4: 'Click ⌄ on any row to expand its full description, audience, and landing-page URLs',
    adminEditorTourDismiss: 'Don\'t show again',
    adminAddProduct: 'Add product',
    adminEditProduct: 'Edit',
    adminDeleteProduct: 'Delete',
    adminConfirmDelete: 'Delete this product?',
    adminSave: 'Save',
    adminCancel: 'Cancel',
    adminFieldEnNameHint: 'On save this product will be referenced internally as code "{id}" (AI recommendations + logs).',
    adminFieldEnNameHintEmpty: 'Enter an English name (required — used as the product\'s unique identifier).',
    adminFieldEnNameCollision: 'Another product\'s English name produces the same code "{id}". Rename to differentiate.',
    adminFieldEnNameRequired: 'Fill in the English name (EN tab) before saving',
    adminFieldName: 'Name',
    adminFieldDescription: 'Description',
    adminFieldAudience: 'Audience',
    adminFieldUrl: 'Landing URL',
    adminFieldParticipating: 'Participating',
    adminSaved: 'Saved',
    adminProductOwner: 'Owner',
    adminProductUnowned: 'Unowned (orphan pool)',
    adminProductClone: 'Clone',
    adminProductCloned: 'Cloned',
    adminProductPublished: 'Published',
    adminProductUnpublished: 'Unpublished',
    adminUsersTitle: 'Authorized users',
    adminUsersInviteEmail: 'Email',
    adminUsersInviteRole: 'Role',
    adminUsersInviteButton: 'Invite',
    adminUsersRevokeButton: 'Revoke',
    adminUsersRoleEditor: 'Editor',
    adminUsersRoleSuperAdmin: 'Super admin',
    adminUsersStatusActivated: 'Activated',
    adminUsersStatusPending: 'Pending first login',
    adminQuickScenariosTitle: 'Quick scenarios',
    adminQuickScenariosHint: 'Pre-canned prompts shown to visitors at the bottom of the homepage. Lecturer can fall back to these when the venue is noisy or STT is unreliable. Saves take effect immediately — no redeploy needed.',
    adminQuickScenariosUnsaved: 'Unsaved changes',
    adminQuickScenariosReset: 'Reset to defaults',
    adminQuickScenariosResetConfirm: 'Reset to bundled defaults? All current customisations will be cleared.',
    adminQuickScenariosFieldRole: 'Role',
    adminQuickScenariosFieldRolePlaceholder: 'VP of Sales',
    adminQuickScenariosFieldIndustry: 'Industry',
    adminQuickScenariosFieldIndustryPlaceholder: 'Tech Company',
    adminQuickScenariosFieldChallenge: 'Challenge',
    adminQuickScenariosFieldChallengePlaceholder: 'Sales-legal collaboration is slow, contract approvals drag.',
    adminQuickScenariosFieldProducts: 'Products this scenario demonstrates (metadata only, does not affect AI)',
    adminQuickScenariosNoProducts: 'No participating products yet.',
    adminQuickScenariosCoverageOk: '✓ All {covered}/{total} participating products covered in {lang}',
    adminQuickScenariosCoverageMissing: '{covered}/{total} participating products covered in {lang}. Missing: {missing} (consider adding a scenario or tagging existing ones)',
    adminQuickScenariosAdd: 'Add scenario',
    adminQuickScenariosEmpty: 'No scenarios for this language. Add one below.',
    adminQuickScenariosMaxReached: 'Limit reached (20)',
    adminUsersInviteEmailSent: 'Invite email sent — they can log in via the link.',
    adminUsersInviteEmailSkipped: 'Added to allow-list. Please notify them to sign in with Google.',
    adminUsersInviteLinkReady: 'Invite link ready for {email}. Copy and send via Lark / WeChat / SMS.',
    adminUsersInviteLinkSkipped: '{email} added to allow-list. Link generation skipped — please notify them to sign in with Google.',
    adminUsersInviteLinkHint: 'Valid for 14 days, single-use. Invalidates on first click. Share via a private channel (Lark / WeChat / SMS).',
    adminUsersInviteLinkCopy: 'Copy link',
    adminUsersInviteLinkCopied: 'Copied',
    ...common,
  },
  ja: {
    inputPlaceholder: '私は多国籍製造業のCFOです。国境を越えた出張経費は混乱しており…',
    inputHint: '業務上の課題を記述すると、AIが最適な3つのシステムを推薦します。',
    generateButton: '推薦を生成',
    generating: '生成中…',
    micStart: '音声入力',
    micStop: '停止',
    micListening: '聞き取り中…',
    micTranscribing: '文字起こし中…',
    quickScenariosTitle: 'クイックシナリオ',
    quickScenarioTemplate: (role, industry, challenge) =>
      `私は${industry}の${role}です。${challenge}`,
    recommendationsTitle: 'AI推薦プラン',
    recommendationsBy: (model, seconds) => `${model} により生成 · ${seconds}s`,
    recommendationsLoadingPhase1: '課題を分析中…',
    recommendationsLoadingPhase2: '候補製品をマッチング中…',
    recommendationsLoadingPhase3: '推薦理由を生成中…',
    rationaleLabel: 'おすすめ理由：',
    rationaleExpand: '詳細を表示',
    rationaleCollapse: '閉じる',
    productCtaLearnMore: '詳しく見る →',
    allProductsTitle: 'すべての製品',
    errorLlmRequired: 'AIキーが未設定です。管理者にお問い合わせください。',
    errorLlmCallFailed: 'AI呼び出しに失敗しました。再試行してください。',
    errorAiInvalid: 'AIの返答が不正です。再試行してください。',
    errorNetwork: 'ネットワークエラーです。接続をご確認ください。',
    errorGeneric: 'エラーが発生しました。再試行してください。',
    offlineBannerTitle: 'オフラインモード',
    offlineBannerHint: 'ネットワークに接続できません。キャッシュされた製品を表示しています。AI 推薦は現在ご利用いただけません。',
    retry: '再試行',
    adminTitle: '管理',
    adminLoginTitle: '管理者ログイン',
    adminLoginInviteHint: '招待メールのリンクをクリックすれば自動で管理画面に入ります。この画面が表示された場合はリンクが失効しているので、下記から再送信してください。',
    adminLoginOtpLabel: 'メールアドレス',
    adminLoginOtpSend: 'ログインリンクを送信',
    adminLoginOtpSending: '送信中…',
    adminLoginOtpSent: '{email} にログインリンクを送信しました。1〜2 分ほどかかる場合があります（迷惑メールもご確認ください）。',
    adminLoginOtpNotInvited: 'このメールは招待されていません。super_admin に招待を依頼してから再試行してください。',
    adminLoginOtpRateLimit: '送信回数が多すぎます。約 1 分後に再試行してください。',
    adminLoginOr: 'または',
    adminLoginDomainWarning: '{domain} のメールはリンクを事前スキャンして無効化することがあります。Gmail / Workspace 推奨。このまま使う場合はモバイルアプリで即座にクリックしてください（PC クライアントの方が厳しめ）。',
    adminSignInWithGoogle: 'Googleアカウントでログイン',
    adminSigningIn: 'ログイン中…',
    adminNotWhitelistedTitle: 'アカウント未認可',
    adminNotWhitelistedHint: 'このメールはホワイトリストに登録されていません。super_adminに招待を依頼してください。',
    adminSwitchAccount: 'アカウント切替',
    adminLogout: 'ログアウト',
    adminBrandSwitchTitle: 'ブランド',
    adminProductsTitle: '製品管理',
    adminProductsEditorHint: '自分の製品 {my} 件 · プラットフォーム参照 {platform} 件（閲覧のみ、編集不可）',
    adminProductBadgeMine: '自分',
    adminProductBadgePlatform: 'プラットフォーム',
    adminProductExpand: '詳細を表示',
    adminProductCollapse: '閉じる',
    adminEditorTourTitle: '👋 はじめての方へ — クイックガイド',
    adminEditorTourStep1: '左上にあなたのメールとロール（編集者）が表示されます',
    adminEditorTourStep2: '「プラットフォーム」バッジは参照テンプレート（閲覧のみ）、「自分」バッジはいつでも編集できます',
    adminEditorTourStep3: '試してみたい？任意の行の「コピー」をクリックでテンプレートを自分のものとして複製、右上「+ 製品追加」で新規作成',
    adminEditorTourStep4: '行右の ⌄ をクリックすると、完全な説明・対象ユーザー・ランディング URL が展開します',
    adminEditorTourDismiss: '今後表示しない',
    adminAddProduct: '製品を追加',
    adminEditProduct: '編集',
    adminDeleteProduct: '削除',
    adminConfirmDelete: 'この製品を削除しますか？',
    adminSave: '保存',
    adminCancel: 'キャンセル',
    adminFieldEnNameHint: '保存後、システムは内部参照（AI 推奨・ログ）でコード "{id}" を使用します。',
    adminFieldEnNameHintEmpty: '英語名を入力してください（必須、製品の一意な識別子として使用）。',
    adminFieldEnNameCollision: '別の製品の英語名から同じコード "{id}" が生成されます。名称を変更して区別してください。',
    adminFieldEnNameRequired: '保存する前に EN タブで英語名を入力してください',
    adminFieldName: '名称',
    adminFieldDescription: '説明',
    adminFieldAudience: '対象ユーザー',
    adminFieldUrl: 'ランディングURL',
    adminFieldParticipating: '推薦対象',
    adminSaved: '保存しました',
    adminProductOwner: 'オーナー',
    adminProductUnowned: '未所有（孤児プール）',
    adminProductClone: '複製',
    adminProductCloned: '複製しました',
    adminProductPublished: '公開中',
    adminProductUnpublished: '非公開',
    adminUsersTitle: '認可ユーザー',
    adminUsersInviteEmail: 'メール',
    adminUsersInviteRole: 'ロール',
    adminUsersInviteButton: '招待',
    adminUsersRevokeButton: '解除',
    adminUsersRoleEditor: '編集者',
    adminUsersRoleSuperAdmin: 'スーパー管理者',
    adminUsersStatusActivated: '有効',
    adminUsersStatusPending: '初回ログイン待ち',
    adminQuickScenariosTitle: 'クイックシナリオ',
    adminQuickScenariosHint: 'ホームページ下部に表示される事前定義シナリオ。会場が騒がしい・音声認識が不安定な時、講師がワンクリックで推奨を呼び出せます。保存後即時反映、再デプロイ不要。',
    adminQuickScenariosUnsaved: '未保存の変更があります',
    adminQuickScenariosReset: 'デフォルトに戻す',
    adminQuickScenariosResetConfirm: '組み込みデフォルトに戻しますか？現在のカスタマイズはすべて削除されます。',
    adminQuickScenariosFieldRole: '役職',
    adminQuickScenariosFieldRolePlaceholder: '営業VP',
    adminQuickScenariosFieldIndustry: '業界',
    adminQuickScenariosFieldIndustryPlaceholder: 'テクノロジー企業',
    adminQuickScenariosFieldChallenge: '課題',
    adminQuickScenariosFieldChallengePlaceholder: '営業と法務の連携が遅く、契約承認に時間がかかる。',
    adminQuickScenariosFieldProducts: 'メインで紹介する製品（タグのみ、AI推奨には影響しません）',
    adminQuickScenariosNoProducts: '現在、推奨対象の製品がありません。',
    adminQuickScenariosCoverageOk: '✓ {lang} で {covered}/{total} の参加製品すべてにシナリオあり',
    adminQuickScenariosCoverageMissing: '{lang} で {covered}/{total} の参加製品にシナリオあり。未カバー：{missing}（シナリオ追加またはタグ調整を検討）',
    adminQuickScenariosAdd: 'シナリオを追加',
    adminQuickScenariosEmpty: 'この言語のシナリオはありません。下のボタンから追加してください。',
    adminQuickScenariosMaxReached: '上限到達 (20)',
    adminUsersInviteEmailSent: '招待メールを送信しました。リンクからログインしてもらえます。',
    adminUsersInviteEmailSkipped: 'ホワイトリストに追加しました。Google でログインするよう手動でご連絡ください。',
    adminUsersInviteLinkReady: '{email} 用の招待リンクを生成しました。Lark / WeChat / SMS でコピーして送信してください。',
    adminUsersInviteLinkSkipped: '{email} をホワイトリストに追加しました。現在の環境ではリンクを生成できません。Google でログインするようご連絡ください。',
    adminUsersInviteLinkHint: '14 日間有効、使い切り。クリックすると即座に無効になります。プライベートな手段（Lark / WeChat / SMS）で送信してください。',
    adminUsersInviteLinkCopy: 'リンクをコピー',
    adminUsersInviteLinkCopied: 'コピー済み',
    ...common,
  },
};

export function t(lang: Lang): UiStrings {
  return TRANSLATIONS[lang];
}
