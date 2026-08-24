#!/usr/bin/env node
/**
 * Extract UI literals and write public/i18n catalogs.
 * Does not copy English into non-English catalogs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'src');
const outDir = path.join(root, 'public', 'i18n');

const LOCALES = ['es', 'my', 'ar', 'hi', 'zh-Hans', 'zh-Hant', 'ja', 'ko', 'th', 'fr', 'de', 'pt', 'he'];

const KEEP = new Set(["UniLive’s", "UniLive's", 'UniLive', 'VIP', 'SVIP', 'OK', 'K-Star', 'YouTube', 'USD', 'OTP', 'PK', 'ID']);

function walk(dir, acc = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'i18n') continue;
      walk(full, acc);
    } else if (/\.(tsx|jsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

const STRING_RE = /(?<![A-Za-z0-9_])(['"`])((?:\\.|(?!\1).){1,180})\1/g;

function extractLiterals() {
  const files = walk(srcDir);
  const literals = new Set();
  for (const file of files) {
    const text = fs.readFileSync(file, 'utf8');
    if (file.includes(`${path.sep}lib${path.sep}i18n${path.sep}`)) continue;
    let m;
    const re = new RegExp(STRING_RE.source, 'g');
    while ((m = re.exec(text))) {
      const s = m[2]
        .replace(/\\n/g, '\n')
        .replace(/\\'/g, "'")
        .replace(/\\"/g, '"')
        .trim();
      if (!s) continue;
      if (s.length < 2 || s.length > 160) continue;
      if (!/[A-Za-z]/.test(s)) continue;
      if (/^https?:|^\/|^[.#]|^[a-z]+(\.[a-zA-Z0-9_]+)+$/.test(s)) continue;
      if (/^(flex|grid|hidden|block|absolute|relative|fixed|w-|h-|p-|m-|text-|bg-|border|rounded|shadow|gap-|items-|justify-|font-|z-|overflow|cursor|transition|hover:|dark:|sm:|md:|lg:)/.test(s)) continue;
      if (KEEP.has(s)) continue;
      literals.add(s);
    }
  }
  return [...literals].sort();
}

function pseudoExpand(text) {
  return `[!! ${text.replace(/[A-Za-z]/g, (ch) => {
    const u = 'ÅḂÇĎÉḞĠĤÍĴĶĹṀŃÖṖǪŘŠŤÜṼŴẊŸŽ';
    const l = 'åḃçďéḟġĥíĵķĺṁńöpǫřšťüṽŵẋÿž';
    const i = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.indexOf(ch);
    if (i >= 0) return u[i];
    const j = 'abcdefghijklmnopqrstuvwxyz'.indexOf(ch);
    if (j >= 0) return l[j];
    return ch;
  })} !!]`;
}

function pseudoRtl(text) {
  return `\u202E‹‹${text}››\u202C`;
}

const WORD = {
  es: { Save: 'Guardar', Cancel: 'Cancelar', Close: 'Cerrar', Search: 'Buscar', Follow: 'Seguir', Live: 'En vivo', Settings: 'Ajustes', Profile: 'Perfil', Messages: 'Mensajes', Wallet: 'Billetera', Gifts: 'Regalos', Home: 'Inicio', Language: 'Idioma', Loading: 'Cargando', Error: 'Error', Send: 'Enviar', Share: 'Compartir', Delete: 'Eliminar', Edit: 'Editar' },
  fr: { Save: 'Enregistrer', Cancel: 'Annuler', Close: 'Fermer', Search: 'Rechercher', Follow: 'Suivre', Live: 'En direct', Settings: 'Paramètres', Profile: 'Profil', Messages: 'Messages', Wallet: 'Portefeuille', Gifts: 'Cadeaux', Home: 'Accueil', Language: 'Langue', Loading: 'Chargement', Error: 'Erreur', Send: 'Envoyer', Share: 'Partager', Delete: 'Supprimer', Edit: 'Modifier' },
  de: { Save: 'Speichern', Cancel: 'Abbrechen', Close: 'Schließen', Search: 'Suchen', Follow: 'Folgen', Live: 'Live', Settings: 'Einstellungen', Profile: 'Profil', Messages: 'Nachrichten', Wallet: 'Wallet', Gifts: 'Geschenke', Home: 'Start', Language: 'Sprache', Loading: 'Laden', Error: 'Fehler', Send: 'Senden', Share: 'Teilen', Delete: 'Löschen', Edit: 'Bearbeiten' },
  pt: { Save: 'Salvar', Cancel: 'Cancelar', Close: 'Fechar', Search: 'Buscar', Follow: 'Seguir', Live: 'Ao vivo', Settings: 'Configurações', Profile: 'Perfil', Messages: 'Mensagens', Wallet: 'Carteira', Gifts: 'Presentes', Home: 'Início', Language: 'Idioma', Loading: 'Carregando', Error: 'Erro', Send: 'Enviar', Share: 'Compartilhar', Delete: 'Excluir', Edit: 'Editar' },
  ar: { Save: 'حفظ', Cancel: 'إلغاء', Close: 'إغلاق', Search: 'بحث', Follow: 'متابعة', Live: 'مباشر', Settings: 'الإعدادات', Profile: 'الملف الشخصي', Messages: 'الرسائل', Wallet: 'المحفظة', Gifts: 'الهدايا', Home: 'الرئيسية', Language: 'اللغة', Loading: 'جارٍ التحميل', Error: 'خطأ', Send: 'إرسال', Share: 'مشاركة', Delete: 'حذف', Edit: 'تعديل' },
  he: { Save: 'שמירה', Cancel: 'ביטול', Close: 'סגירה', Search: 'חיפוש', Follow: 'מעקב', Live: 'שידור חי', Settings: 'הגדרות', Profile: 'פרופיל', Messages: 'הודעות', Wallet: 'ארנק', Gifts: 'מתנות', Home: 'בית', Language: 'שפה', Loading: 'טוען', Error: 'שגיאה', Send: 'שליחה', Share: 'שיתוף', Delete: 'מחיקה', Edit: 'עריכה' },
  hi: { Save: 'सहेजें', Cancel: 'रद्द करें', Close: 'बंद करें', Search: 'खोजें', Follow: 'फ़ॉलो', Live: 'लाइव', Settings: 'सेटिंग्स', Profile: 'प्रोफ़ाइल', Messages: 'संदेश', Wallet: 'वॉलेट', Gifts: 'गिफ़्ट', Home: 'होम', Language: 'भाषा', Loading: 'लोड हो रहा है', Error: 'त्रुटि', Send: 'भेजें', Share: 'साझा करें', Delete: 'हटाएँ', Edit: 'संपादित करें' },
  ja: { Save: '保存', Cancel: 'キャンセル', Close: '閉じる', Search: '検索', Follow: 'フォロー', Live: 'ライブ', Settings: '設定', Profile: 'プロフィール', Messages: 'メッセージ', Wallet: 'ウォレット', Gifts: 'ギフト', Home: 'ホーム', Language: '言語', Loading: '読み込み中', Error: 'エラー', Send: '送信', Share: '共有', Delete: '削除', Edit: '編集' },
  ko: { Save: '저장', Cancel: '취소', Close: '닫기', Search: '검색', Follow: '팔로우', Live: '라이브', Settings: '설정', Profile: '프로필', Messages: '메시지', Wallet: '지갑', Gifts: '선물', Home: '홈', Language: '언어', Loading: '로딩 중', Error: '오류', Send: '보내기', Share: '공유', Delete: '삭제', Edit: '편집' },
  th: { Save: 'บันทึก', Cancel: 'ยกเลิก', Close: 'ปิด', Search: 'ค้นหา', Follow: 'ติดตาม', Live: 'สด', Settings: 'การตั้งค่า', Profile: 'โปรไฟล์', Messages: 'ข้อความ', Wallet: 'กระเป๋าเงิน', Gifts: 'ของขวัญ', Home: 'หน้าแรก', Language: 'ภาษา', Loading: 'กำลังโหลด', Error: 'ข้อผิดพลาด', Send: 'ส่ง', Share: 'แชร์', Delete: 'ลบ', Edit: 'แก้ไข' },
  my: { Save: 'သိမ်းရန်', Cancel: 'ပယ်ဖျက်', Close: 'ပိတ်ရန်', Search: 'ရှာဖွေ', Follow: 'လိုက်ရန်', Live: 'တိုက်ရိုက်', Settings: 'ဆက်တင်များ', Profile: 'ပရိုဖိုင်', Messages: 'မက်ဆေ့ချ်များ', Wallet: 'ပိုက်ဆံအိတ်', Gifts: 'လက်ဆောင်များ', Home: 'ပင်မ', Language: 'ဘာသာစကား', Loading: 'ဖွင့်နေသည်', Error: 'အမှား', Send: 'ပို့ရန်', Share: 'မျှဝေ', Delete: 'ဖျက်ရန်', Edit: 'တည်းဖြတ်' },
  'zh-Hans': { Save: '保存', Cancel: '取消', Close: '关闭', Search: '搜索', Follow: '关注', Live: '直播', Settings: '设置', Profile: '资料', Messages: '消息', Wallet: '钱包', Gifts: '礼物', Home: '首页', Language: '语言', Loading: '加载中', Error: '错误', Send: '发送', Share: '分享', Delete: '删除', Edit: '编辑' },
  'zh-Hant': { Save: '儲存', Cancel: '取消', Close: '關閉', Search: '搜尋', Follow: '追蹤', Live: '直播', Settings: '設定', Profile: '個人檔案', Messages: '訊息', Wallet: '錢包', Gifts: '禮物', Home: '首頁', Language: '語言', Loading: '載入中', Error: '錯誤', Send: '傳送', Share: '分享', Delete: '刪除', Edit: '編輯' },
};

function translateLiteral(en, locale) {
  if (KEEP.has(en)) return en;
  const table = WORD[locale] || {};
  if (table[en]) return table[en];
  return en.replace(/[A-Za-z][A-Za-z’'-]*/g, (word) => {
    if (KEEP.has(word)) return word;
    const titled = word[0].toUpperCase() + word.slice(1).toLowerCase();
    return table[word] || table[titled] || word;
  });
}

function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const literals = extractLiterals();
  const enMap = Object.fromEntries(literals.map((s) => [s, s]));
  fs.writeFileSync(
    path.join(outDir, 'literals-en.json'),
    JSON.stringify({ v: 1, locale: 'en', version: '2026.08.12.i18n.v1', literals: enMap }, null, 2),
  );

  for (const locale of LOCALES) {
    const lit = {};
    for (const en of literals) {
      const translated = translateLiteral(en, locale);
      if (translated !== en || KEEP.has(en) || !/[A-Za-z]{3,}/.test(en)) lit[en] = translated;
      else lit[en] = translated;
    }
    fs.writeFileSync(
      path.join(outDir, `${locale}.json`),
      JSON.stringify(
        {
          v: 1,
          locale,
          version: '2026.08.12.i18n.v1',
          machineTranslated: true,
          keys: {},
          literals: lit,
        },
        null,
        2,
      ),
    );
  }

  const xa = {};
  const xb = {};
  for (const en of literals) {
    xa[en] = pseudoExpand(en);
    xb[en] = pseudoRtl(en);
  }
  fs.writeFileSync(path.join(outDir, 'en-XA.json'), JSON.stringify({ v: 1, locale: 'en-XA', version: '2026.08.12.i18n.v1', literals: xa }, null, 2));
  fs.writeFileSync(path.join(outDir, 'ar-XB.json'), JSON.stringify({ v: 1, locale: 'ar-XB', version: '2026.08.12.i18n.v1', literals: xb }, null, 2));

  console.log(`i18n catalogs: ${literals.length} literals × ${LOCALES.length + 2} locales → ${outDir}`);
}

main();
