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
  // Admin
  adminTitle: string;
  adminLoginTitle: string;
  adminPasswordLabel: string;
  adminLoginButton: string;
  adminLoggingIn: string;
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
    adminTitle: '管理台',
    adminLoginTitle: '管理员登录',
    adminPasswordLabel: '密码',
    adminLoginButton: '登录',
    adminLoggingIn: '登录中…',
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
    rationaleExpand: '展開詳情',
    rationaleCollapse: '收起',
    productCtaLearnMore: '了解更多 →',
    allProductsTitle: '全部產品',
    errorLlmRequired: 'AI 密鑰未配置，請聯繫管理員。',
    errorLlmCallFailed: 'AI 調用失敗，請稍後重試。',
    errorAiInvalid: 'AI 返回數據異常，請重試。',
    errorNetwork: '網絡異常，請檢查連接。',
    errorGeneric: '出錯了，請重試。',
    retry: '重試',
    adminTitle: '管理台',
    adminLoginTitle: '管理員登錄',
    adminPasswordLabel: '密碼',
    adminLoginButton: '登錄',
    adminLoggingIn: '登錄中…',
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
    rationaleExpand: 'Show more',
    rationaleCollapse: 'Show less',
    productCtaLearnMore: 'Learn more →',
    allProductsTitle: 'All products',
    errorLlmRequired: 'AI key not configured. Please contact the administrator.',
    errorLlmCallFailed: 'AI call failed. Please try again.',
    errorAiInvalid: 'AI returned invalid data. Please retry.',
    errorNetwork: 'Network error. Please check your connection.',
    errorGeneric: 'Something went wrong. Please retry.',
    retry: 'Retry',
    adminTitle: 'Admin',
    adminLoginTitle: 'Admin login',
    adminPasswordLabel: 'Password',
    adminLoginButton: 'Log in',
    adminLoggingIn: 'Logging in…',
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
    rationaleExpand: '詳細を表示',
    rationaleCollapse: '閉じる',
    productCtaLearnMore: '詳しく見る →',
    allProductsTitle: 'すべての製品',
    errorLlmRequired: 'AIキーが未設定です。管理者にお問い合わせください。',
    errorLlmCallFailed: 'AI呼び出しに失敗しました。再試行してください。',
    errorAiInvalid: 'AIの返答が不正です。再試行してください。',
    errorNetwork: 'ネットワークエラーです。接続をご確認ください。',
    errorGeneric: 'エラーが発生しました。再試行してください。',
    retry: '再試行',
    adminTitle: '管理',
    adminLoginTitle: '管理者ログイン',
    adminPasswordLabel: 'パスワード',
    adminLoginButton: 'ログイン',
    adminLoggingIn: 'ログイン中…',
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
    ...common,
  },
};

export function t(lang: Lang): UiStrings {
  return TRANSLATIONS[lang];
}
