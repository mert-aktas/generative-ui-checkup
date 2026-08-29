/**
 * Generative UI Check-up: Turkish content maps.
 *
 * Every public string lives here exactly once. Screen rendering and the Canvas share
 * card both read this module plus the result object from ./scoring.js, so no display
 * string is ever computed twice.
 *
 * Source of truth: ../../COPY-TR.md for public copy, ../../SCORING.md for question and
 * option wording. tests/scoring.test.js re-parses both documents and fails on any drift,
 * so edit the markdown first and mirror it here.
 */

/** Freeze the content maps so a renderer cannot mutate shared copy. */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Reflect.ownKeys(value)) deepFreeze(value[key]);
  }
  return value;
}

/**
 * The eight questions in presentation order. `dimension` matches the profile ids in
 * ./scoring.js; the tests assert the two stay in step. Option index is the answer value.
 * Every question carries a short help disclosure.
 */
export const QUESTIONS = deepFreeze([
  {
    id: "q1",
    dimension: "valueFit",
    text: "Bu görevi farklı kullanıcılar tamamladığında ihtiyaç duydukları ekran ve adımlar ne kadar değişiyor?",
    options: [
      "Değişmez: herkes aynı adımları ve aynı ekranı kullanır",
      "Yapı aynı kalır; yalnız içerik veya öncelik değişir",
      "Rol veya ürün durumu bazı bileşenleri ve adımların sırasını değiştirir",
      "Değişken çalışma ekranı gerekir: amaç, rol ve canlı durum ekranın büyük bölümünü değiştirir"
    ],
    help: {
      label: "Değişken çalışma ekranı ne demek?",
      body: "Değişken çalışma ekranı, aynı görevin kullanıcının amacı, rolü veya mevcut durumuna göre farklı bileşenlerle yürütülmesidir. Generative UI ancak bu fark görevi tamamlama biçimini gerçekten iyileştiriyorsa anlamlı değer yaratır."
    }
  },
  {
    id: "q2",
    dimension: "valueFit",
    text: "Bu görevin kullanıcı ve iş sonucu üzerindeki etkisi nedir?",
    options: [
      "Nadiren yapılır; etkisi daha çok görseldir",
      "Tekrarlanır ancak kullanıcı veya iş sonucu üzerindeki etkisi düşüktür",
      "Sık yapılır, birden fazla adımdan oluşur ve önemli bir sonucu etkiler",
      "Bu, kritik kullanıcı görevlerinden biridir; activation, retention veya revenue için doğrudan önemlidir"
    ],
    help: {
      label: "Kritik kullanıcı görevi ne demek?",
      body: "Kritik kullanıcı görevi, kullanıcının üründen değer almasını veya işletmenin önemli bir sonucunu doğrudan etkileyen iştir. İlk kurulumu tamamlamak activation'ı, düzenli rapor hazırlamak retention'ı, plan yükseltmek ise revenue'yu etkileyebilir."
    }
  },
  {
    id: "q3",
    dimension: "systemReadiness",
    text: "Bu görevi destekleyen mevcut ürün ekranları ne kadar yeniden kullanılabilir bileşenlerden oluşuyor?",
    options: [
      "Ekranlar sayfaya özel yazılmıştır; parçalar birbirine sıkı bağlıdır",
      "Ortak görsel bloklar vardır; davranışları hâlâ sayfaya bağlıdır",
      "Yeniden kullanılabilir bileşenler ve tanımlı durumlar vardır",
      "Bileşen girdileri, durumları, izinleri ve hata davranışları güncel bileşen sözleşmeleriyle tanımlıdır"
    ],
    help: {
      label: "Bileşen sözleşmesi ne demek?",
      body: "Bileşen sözleşmesi, bir bileşenin hangi veriyi kabul ettiğini, hangi durumlarda çalıştığını, kimlerin kullanabildiğini ve hata halinde ne göstereceğini tanımlar. Generative UI güvenli bir ekran kurabilmek için bu sınırları açık biçimde bilmelidir."
    }
  },
  {
    id: "q4",
    dimension: "systemReadiness",
    text: "Ürününüz, bu görev sırasında doğru içerik veya akışı seçmek için hangi güvenilir bağlam sinyallerini kullanıyor?",
    options: [
      "Kullanıcının bulunduğu sayfa dışında anlamlı bir sinyal kullanılmıyor",
      "Rol, plan veya hesap bilgisi kullanılabiliyor",
      "Bunlara ek olarak canlı ürün durumu ve yakın tarihli kullanıcı hareketleri kullanılabiliyor",
      "Açık kullanıcı amacı, canlı durum, izin verilen geçmiş ve yetkiler birlikte kullanılabiliyor"
    ],
    help: {
      label: "Bağlam sinyali ne demek?",
      body: "Bağlam sinyali; kullanıcının rolü, planı, açık amacı, son hareketleri veya hesabın güncel durumu gibi ekran kararını etkileyen bilgidir. Generative UI'ın doğru bir yüzey seçebilmesi için sinyalin güncel, izinli ve kaynağı belli olması gerekir."
    }
  },
  {
    id: "q5",
    dimension: "controlSafety",
    text: "Kullanıcı bu görev sırasında yanlış, alakasız veya beklemediği bir ekrana geldiğinde nasıl toparlanıyor?",
    options: [
      "Ekranın neden değiştiğini göremez; güvenilir bir geri dönüş yolu yoktur",
      "Geri çıkabilir veya akışı baştan başlatabilir",
      "Değişikliğin nedenini görebilir; seçimini değiştirebilir veya standart ekrana dönebilir",
      "Güvenli geri dönüş vardır: kullanıcı ekranı önizleyebilir, seçimini düzenleyebilir, sıfırlayabilir veya standart akışa dönebilir"
    ],
    help: {
      label: "Güvenli geri dönüş ne demek?",
      body: "Güvenli geri dönüş, beklenmeyen bir ekran veya akış işe yaramadığında kullanıcının dönebileceği güvenilir yoldur. Önceki görünüm, standart ürün ekranı, düzenleme veya sıfırlama seçeneği bu güveni sağlar."
    }
  },
  {
    id: "q6",
    dimension: "controlSafety",
    text: "Bu görev sırasında ödeme, veri silme veya yetki değiştirme gibi kritik bir işlem başlatıldığında hangi korumalar devreye giriyor?",
    options: [
      "İşlem doğrudan çalışıyor",
      "Standart bir onay ekranı gösteriliyor",
      "İzin kontrolü ve işlem özeti gösteriliyor; geri alma veya işlem kaydı bulunuyor",
      "Yalnız önceden onaylanmış işlemler; önizleme, izin, iş kuralı ve denetim kaydıyla çalışıyor"
    ],
    help: {
      label: "Kritik işlem ne demek?",
      body: "Kritik işlem; para, veri, erişim veya müşteri iletişimi üzerinde etkisi olan ve geri alınması zor olabilen işlemdir. Generative UI hazırlığında bu işlemler model kararına bırakılmamalı; izin, önizleme ve denetim kurallarıyla sınırlandırılmalıdır."
    }
  },
  {
    id: "q7",
    dimension: "discoveryResilience",
    text: "Ekibiniz, bu görevi destekleyen özellikleri ve kuralları bugün nerede tanımlıyor?",
    options: [
      "Ürünün yapabildiği işleri gösteren güncel bir envanter yok",
      "Bilgi dokümantasyonda veya ekipler arasında dağınık halde duruyor",
      "Sahibi ve hedef kullanıcısı tanımlı, güncel bir özellik kataloğu var",
      "Özellik kataloğu güncel ve aranabilir; rol, izin ve ön koşullarla bağlantılı"
    ],
    help: {
      label: "Özellik kataloğu ne demek?",
      body: "Özellik kataloğu, ürünün yapabildiği işleri menü yapısından bağımsız olarak tanımlayan güncel envanterdir. Generative UI'ın uygun yetenekleri seçebilmesi için özelliklerin hedef kullanıcısı, izinleri, ön koşulları ve sahibi burada açık olmalıdır."
    }
  },
  {
    id: "q8",
    dimension: "discoveryResilience",
    text: "Bu görev için gereken bir özellik o an ekranda görünmüyorsa kullanıcı onu bugün nasıl buluyor?",
    options: [
      "Ancak özelliğin adını biliyorsa arıyor veya support ekibine soruyor",
      "Dokümantasyonda ya da aramada bulabiliyor",
      "Ekrandan bağımsız, gezilebilir bir ürün içi merkezden keşfedebiliyor",
      "Keşfedilebilirlik birden fazla yolla sağlanıyor: gezilebilir ürün merkezi, bağlama uygun yönlendirme ve son kullanılanlara dönüş"
    ],
    help: {
      label: "Keşfedilebilirlik ne demek?",
      body: "Keşfedilebilirlik, bir özellik o an ekranda görünmese bile kullanıcının onu daha sonra bulabilmesidir. Generative UI kişiye özel yüzeyler oluşturduğunda aranabilir katalog, ürün merkezi ve son kullanılanlara dönüş daha da önemli hale gelir."
    }
  }
]);

/** Public profile names, keyed by the profile ids in ./scoring.js. */
/* ------------------------------------------------------- the selected task */

/**
 * The one free-text value in the product: the single user task the whole check-up is
 * about. It reaches the DOM and the editable LinkedIn draft as text, and nothing else.
 * See PRODUCT-SPEC.md "Task selection and answering instruction" for the contract.
 */
export const TASK_LIMITS = deepFreeze({ min: 3, max: 80 });

/** C0 and C1 control characters, minus tab, newline and carriage return. */
const TASK_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

/** Unicode bidi overrides and isolates, which can reorder text on screen. */
const TASK_BIDI = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

/**
 * Zero-width and default-ignorable formatting characters.
 *
 * These render as nothing on their own, so they must not count towards the three-character
 * minimum. Without this, a task of three zero-width spaces validates and then displays as an
 * empty pair of quotes.
 *
 * Variation selectors (U+FE00-U+FE0F) are deliberately *not* in this set. They cannot pad a
 * length on their own because they only ever follow a base character, and stripping them would
 * silently rewrite the user's emoji, turning a text-presentation sequence into a different glyph.
 */
const TASK_INVISIBLE = /[\u00AD\u180E\u200B-\u200D\u2060-\u2064\uFEFF\uFFF9-\uFFFB]/g;

/**
 * Normalize a raw task value: drop characters that can lie about their own rendering or occupy
 * no space at all, fold every kind of whitespace into single spaces, and trim.
 *
 * The minimum length is therefore a minimum of *visible* characters: invisible padding is gone
 * before anything is counted.
 *
 * This is not HTML sanitization. Markup is left intact on purpose, because every
 * insertion point writes the value with `textContent` and never parses it.
 */
export function normalizeTask(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .replace(TASK_CONTROL, "")
    .replace(TASK_BIDI, "")
    .replace(TASK_INVISIBLE, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Length in Unicode code points, so one emoji counts as one character. */
export function taskLength(value) {
  return typeof value === "string" ? [...value].length : 0;
}

/** True when a raw value normalizes to something inside the documented limits. */
export function isValidTask(raw) {
  const length = taskLength(normalizeTask(raw));
  return length >= TASK_LIMITS.min && length <= TASK_LIMITS.max;
}

/** Instruction-screen copy for choosing the task. Source: COPY-TR.md. */
export const TASK_COPY = deepFreeze({
  heading: "Önce değerlendireceğiniz görevi seçin",
  intro: "Ürününüzde kullanıcıların sık yaptığı ve sonucu önemli olan tek bir görevi seçin. Sonraki sekiz soruda ürününüzün bu görevi bugün nasıl desteklediğini değerlendireceğiz.",
  presetGroupLabel: "Hazır örnekler",
  presets: [
    "İlk kurulumu tamamlamak",
    "Bir rapor hazırlamak",
    "Ekip arkadaşını davet etmek",
    "Bir entegrasyonu kurmak",
    "Kendi görevimi yazacağım"
  ],
  freeWritePreset: "Kendi görevimi yazacağım",
  inputLabel: "Değerlendirilecek görev",
  placeholder: "Örnek: Yeni kullanıcının ilk projesini oluşturması",
  helper: "Kısa ve genel yazın; müşteri veya şirket adı eklemeyin.",
  counterTemplate: "{count}/80",
  errorTooShort: "Devam etmek için en az 3 karakterlik bir görev yazın.",
  errorTooLong: "Görev en fazla 80 karakter olabilir."
});

export const PROFILE_NAMES = deepFreeze({
  valueFit: "Kullanım senaryosu",
  systemReadiness: "Teknik hazırlık",
  controlSafety: "Kontrol ve güvenlik",
  discoveryResilience: "Keşfedilebilirlik"
});

/** Public band labels, keyed by the band ids in ./scoring.js. */
export const BAND_LABELS = deepFreeze({
  weak: "Zayıf",
  partial: "Kısmi",
  strong: "Güçlü"
});

/**
 * Archetype copy, keyed by the archetype ids in ./scoring.js.
 *
 * The A5 summary already carries the "Bu sonuç, ürünü canlıya alma onayı değildir." sentence that
 * SCORING.md requires appended to every A5 body, so the renderer appends nothing.
 */
export const ARCHETYPE_CONTENT = deepFreeze({
  problem_seeking_genui: {
    title: "ÖNCE DOĞRU GÖREVİ BULUN",
    summary: "Generative UI fikri var, fakat hangi kullanıcı görevinde ölçülebilir değer yaratacağı henüz net değil.",
    experiment: "Tek bir görevi seçin. Yeni ve deneyimli kullanıcıların ihtiyaç duyduğu adımlar gerçekten değişiyor mu, beş kullanıcı görüşmesiyle doğrulayın."
  },
  idea_ready_ground_not: {
    title: "SENARYO VAR, ALTYAPI HAZIR DEĞİL",
    summary: "Generative UI için anlamlı bir kullanım alanı görüyorsunuz. Ancak bileşen sistemi, bağlam sinyalleri veya güvenli geri dönüş katmanı pilot için henüz yeterli değil.",
    experiment: "Kritik işlem içermeyen tek bir görev seçin. Mevcut bileşenlerle çalışan ve sabit ekrana dönebilen bir prototip hazırlayın."
  },
  composition_ready_catalog_blind: {
    title: "EKRAN HAZIR, ÜRÜN KATALOĞU KAYIP",
    summary: "Ekranı dinamik kurabilecek teknik zemin güçlü. Ancak sistem ürünün tüm özelliklerini menüden bağımsız tanımıyor; görünmeyen işler kullanıcı için yok olabilir.",
    experiment: "Tek bir ürün alanı için menüden bağımsız, aranabilir bir özellik kataloğu çıkarın ve gizlenen bir özelliğin yeniden bulunabildiğini test edin."
  },
  pilot_ground_discovery_partial: {
    title: "PİLOT MÜMKÜN, KEŞİF EKSİK",
    summary: "Dar bir Generative UI pilotu mümkün. Ancak özellik keşfi ya da diğer hazırlık alanlarından en az biri hâlâ eksik; pilot kalıcı navigasyonu gölgelememeli.",
    experiment: "Tek bir görevi uyarlayın. Görev başarısını, sabit ekrana dönüşü ve görünmeyen özelliklerin bulunmasını aynı pilotta ölçün."
  },
  controlled_trial_ground: {
    title: "KONTROLLÜ PİLOTA HAZIRSINIZ",
    summary: "Yanıtlarınıza göre tek görevle sınırlı, ölçülebilir ve geri alınabilir bir Generative UI pilotu için temeliniz var. Bu sonuç, ürünü canlıya alma onayı değildir.",
    experiment: "Tek bir görev ve kullanıcı segmenti seçin. Yetkileri sınırlandırın, kalıcı ekranı koruyun ve pilotu feature flag arkasında çalıştırın."
  }
});

/**
 * Strength copy. `fallback` replaces the strength module when the highest answer is 0,
 * which the result object signals with `strengthIsFallback`.
 */
export const STRENGTH_COPY = deepFreeze({
  q1: "Generative UI için gerçekten farklılaşan bir kullanıcı görevi tanımlamışsınız.",
  q2: "Seçtiğiniz görev activation, retention veya revenue açısından anlamlı bir etkiye sahip.",
  q3: "Bileşen sisteminiz, ekranı güvenli biçimde yeniden kurmak için kullanılabilir durumda.",
  q4: "Doğru ekranı seçmek için güvenilir ve izinli bağlam sinyalleriniz var.",
  q5: "Kullanıcı üretilen ekranı anlayabiliyor, değiştirebiliyor ve sabit ekrana dönebiliyor.",
  q6: "Kritik işlemler izin, önizleme ve denetim kaydıyla korunuyor.",
  q7: "Özellik kataloğunuz ana menüden bağımsız ve sistem tarafından okunabilir.",
  q8: "Generative UI göstermese bile özellikler kullanıcı tarafından yeniden bulunabiliyor.",
  fallback: "Generative UI hazırlığında ilk işiniz net: pilot seçmeden önce temel kullanım problemini ve güvenlik sınırlarını tanımlayın."
});

/** Recommendation copy for the two priority gaps. */
/**
 * The two questions the result highlights.
 *
 * Two questions are always selected, including when every answer is the maximum, so these
 * lines must be true at every answer value. Each names a control to establish and verify
 * during the pilot; none of them asserts that the capability is missing.
 */
export const RECOMMENDATION_COPY = deepFreeze({
  q1: "Pilotu tek bir kullanıcı görevine sabitleyin; rol veya ürün durumu değiştiğinde gerekli ekranın gerçekten değiştiğini ölçerek doğrulayın.",
  q2: "Pilotu activation, retention veya revenue ile ilişkili tek bir ölçülebilir sonuca bağlayın ve bu sonucu pilot boyunca izleyin.",
  q3: "Pilot kapsamındaki bileşenlerin girdilerini, durumlarını, izinlerini ve hata davranışlarını sistemin okuyabileceği biçimde pilotta güvence altına alın.",
  q4: "Pilotta kullanılacak bağlam sinyallerini güncel, izinli ve kaynağı belli bir listeyle sınırlandırın; bu sınırı pilot boyunca koruyun.",
  q5: "Ekranın neden gösterildiğini açıklayan; düzenleme, sıfırlama ve standart akışa dönüş yollarını pilotta güvence altına alın.",
  q6: "Kritik işlemleri izin kontrolü, açık özet, onay ve denetim kaydıyla pilotta güvence altına alın.",
  q7: "Menüden bağımsız, güncel ve aranabilir özellik kataloğunu; sahip, hedef kullanıcı, izin ve ön koşul bilgisiyle birlikte pilotta güvence altına alın.",
  q8: "Görünmeyen özelliklerin bulunabilmesini aranabilir ürün merkezi, bağlama uygun yönlendirme ve son kullanılanlara dönüş yoluyla pilotta güvence altına alın."
});

/**
 * The handful of public strings the renderer produces at runtime. Everything else is
 * authored directly in index.html, so each string still exists exactly once.
 * Share and card copy is added in Phase 3.
 */
export const UI_COPY = deepFreeze({
  progress: "Soru {current} / 8",
  next: "Devam",
  finish: "Sonucumu göster",
  unansweredError: "Devam etmek için ürününüzde bugün geçerli olan seçeneği işaretleyin.",
  resultError: "Sonuç hesaplanamadı. Yanıtlarınızı kontrol edip yeniden deneyin.",
  begin: "Check-up'a başla",
  taskLabel: "Değerlendirilen görev",
  pilotScope: "İlk pilotunuzu \u201C{task}\u201D görevinin kritik işlem içermeyen, geri alınabilir bir bölümüyle sınırlandırın.",
  cardPreparing: "Karne hazırlanıyor…",
  shareLinkedIn: "LinkedIn'de paylaş",
  shareNative: "Paylaşım ekranını aç",
  shareOpened: "LinkedIn açıldı. Karne görselini gönderiye eklemek için Cmd+V veya Ctrl+V kullanın.",
  clipboardFailure: "Post metniniz LinkedIn'de açıldı, ancak karne görseli panoya kopyalanamadı. Görseli yeniden kopyalamayı deneyebilir veya sonuç ekranının görüntüsünü alabilirsiniz.",
  clipboardRetry: "Görseli yeniden kopyala",
  clipboardRetrySuccess: "Karne görseli panoya kopyalandı. LinkedIn sekmesinde Cmd+V veya Ctrl+V ile ekleyebilirsiniz.",
  clipboardRetryFailure: "Karne görseli yine kopyalanamadı. Sonuç ekranının görüntüsünü alıp postunuza ekleyebilirsiniz.",
  popupBlocked: "Tarayıcı yeni sekmeyi engelledi. Metniniz burada duruyor; LinkedIn'i aşağıdaki düğmeden açabilirsiniz.",
  popupBlockedAction: "LinkedIn'i aç",
  shareCancelled: "Paylaşım iptal edildi. Metniniz burada duruyor; hazır olduğunuzda yeniden deneyebilirsiniz.",
  cardError: "Sonuç karnesi hazırlanamadı. Sonuç ekranının görüntüsünü alıp postunuza ekleyebilirsiniz.",
  shareFailure: "Paylaşım ekranı açılamadı. Metniniz kaybolmadı; yeniden deneyebilir veya sonuç ekranının görüntüsünü alabilirsiniz."
});

/**
 * Share-card strings. Every value is derived from COPY-TR.md: the lockup halves and
 * the URL lines are splits of the published attribution and canonical URL, and the
 * next-step label is the published Experiment heading, upper-cased with Turkish
 * casing rules at draw time. No card string is authored here.
 */
export const CARD_COPY = deepFreeze({
  eyebrow: "GENERATIVE UI CHECK-UP",
  lockupLeft: "Soft Commitment",
  lockupRight: "UserGuiding",
  nextLabelSource: "Önerilen ilk Generative UI pilotu",
  footerStrong: "Generative UI hazırlık özeti.",
  footerNote: "8 soruluk öz değerlendirme.",
  footerUrlTop: "games.userguiding.com/",
  footerUrlBottom: "generative-ui-checkup/"
});

/**
 * Editable post copy. `{archetype}`, `{strength}`, `{experiment}` and `{url}` are always
 * replaced; the `{task}` line is dropped whole when no task is available.
 *
 * `{url}` is deliberately not the last thing in the text. LinkedIn's composer strips a trailing
 * URL out of the caption while it builds the link preview, so a draft that ends on the link
 * arrives with the link missing. Copy after the URL is what keeps it. Do not "tidy" the link
 * back to the end; a test fails if anything does.
 */
export const SHARE_COPY = deepFreeze({
  title: "Generative UI Check-up sonucum",
  text: "Generative UI Check-up sonucum: {archetype}\n\nDeğerlendirdiğim görev: {task}\n\nBugünkü güçlü temelim:\n{strength}\n\nİlk pilot adımım:\n{experiment}\n\nCheck-up burada: {url}\n\nSizce ürününüz Generative UI için ne kadar hazır?",
  taskLine: "Değerlendirdiğim görev: {task}",
  url: "https://games.userguiding.com/generative-ui-checkup/?utm_source=generative_ui_checkup"
});

export const PARTNER_COPY = deepFreeze({
  heading: "Hazırlayanlar",
  softCommitment: "AI, startup'lar ve yeni ekonomi üzerine iki haftada bir yayımlanan bağımsız bülten.",
  userGuiding: "Ürün ekiplerinin kod yazmadan onboarding ve ürün içi deneyimler oluşturmasını sağlayan product adoption platformu."
});
