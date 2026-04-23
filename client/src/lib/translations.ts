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
  adminSignInWithGoogle: string;
  adminSigningIn: string;
  adminNotWhitelistedTitle: string;
  adminNotWhitelistedHint: string;
  adminSwitchAccount: string;
  adminLogout: string;
  adminBrandSwitchTitle: string;
  adminProductsTitle: string;
  adminAddProduct: string;
  adminEditProduct: string;
  adminDeleteProduct: string;
  adminConfirmDelete: string;
  adminSave: string;
  adminCancel: string;
  adminFieldId: string;
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
    adminSignInWithGoogle: '使用 Google 账号登录',
    adminSigningIn: '登录中…',
    adminNotWhitelistedTitle: '账号未授权',
    adminNotWhitelistedHint: '你的邮箱未在白名单里。请联系 super_admin 添加后再登录。',
    adminSwitchAccount: '切换账号',
    adminLogout: '退出',
    adminBrandSwitchTitle: '品牌切换',
    adminProductsTitle: '产品管理',
    adminAddProduct: '新增产品',
    adminEditProduct: '编辑',
    adminDeleteProduct: '删除',
    adminConfirmDelete: '确定删除此产品？',
    adminSave: '保存',
    adminCancel: '取消',
    adminFieldId: 'ID',
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
    adminSignInWithGoogle: '使用 Google 帳號登錄',
    adminSigningIn: '登錄中…',
    adminNotWhitelistedTitle: '帳號未授權',
    adminNotWhitelistedHint: '你的郵箱未在白名單內。請聯絡 super_admin 新增後再登錄。',
    adminSwitchAccount: '切換帳號',
    adminLogout: '退出',
    adminBrandSwitchTitle: '品牌切換',
    adminProductsTitle: '產品管理',
    adminAddProduct: '新增產品',
    adminEditProduct: '編輯',
    adminDeleteProduct: '刪除',
    adminConfirmDelete: '確定刪除此產品？',
    adminSave: '保存',
    adminCancel: '取消',
    adminFieldId: 'ID',
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
    adminSignInWithGoogle: 'Sign in with Google',
    adminSigningIn: 'Signing in…',
    adminNotWhitelistedTitle: 'Account not authorized',
    adminNotWhitelistedHint: 'Your email is not on the allow-list. Ask a super_admin to invite you, then try again.',
    adminSwitchAccount: 'Switch account',
    adminLogout: 'Log out',
    adminBrandSwitchTitle: 'Brand',
    adminProductsTitle: 'Products',
    adminAddProduct: 'Add product',
    adminEditProduct: 'Edit',
    adminDeleteProduct: 'Delete',
    adminConfirmDelete: 'Delete this product?',
    adminSave: 'Save',
    adminCancel: 'Cancel',
    adminFieldId: 'ID',
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
    adminSignInWithGoogle: 'Googleアカウントでログイン',
    adminSigningIn: 'ログイン中…',
    adminNotWhitelistedTitle: 'アカウント未認可',
    adminNotWhitelistedHint: 'このメールはホワイトリストに登録されていません。super_adminに招待を依頼してください。',
    adminSwitchAccount: 'アカウント切替',
    adminLogout: 'ログアウト',
    adminBrandSwitchTitle: 'ブランド',
    adminProductsTitle: '製品管理',
    adminAddProduct: '製品を追加',
    adminEditProduct: '編集',
    adminDeleteProduct: '削除',
    adminConfirmDelete: 'この製品を削除しますか？',
    adminSave: '保存',
    adminCancel: 'キャンセル',
    adminFieldId: 'ID',
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
    ...common,
  },
};

export function t(lang: Lang): UiStrings {
  return TRANSLATIONS[lang];
}
