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
 * A help disclosure is allowed on q3, q4 and q6 only.
 */
export const QUESTIONS = deepFreeze([
  {
    id: "q1",
    dimension: "valueFit",
    text: "Aynı işi yapan iki kullanıcı için doğru çalışma yüzeyi ne kadar farklı olmalı?",
    options: [
      "Neredeyse hiç: aynı adımlar, aynı ekran",
      "Aynı yapı, farklı içerik veya öncelik",
      "Rol ya da ürün durumu bazı bileşenleri ve sıralamayı değiştiriyor",
      "Amaç, rol ve canlı duruma göre yüzeyin büyük bölümü değişmeli"
    ],
    help: null
  },
  {
    id: "q2",
    dimension: "valueFit",
    text: "Bu değişken yüzeye ihtiyaç duyulan işler ürününüzde ne kadar önemli?",
    options: [
      "Nadiren oluyor; daha çok kozmetik bir fark",
      "Tekrarlanıyor ama düşük etkili",
      "Sık oluyor ve birkaç adım sürüyor",
      "Ürünün ana işi; sık, çok adımlı ve zaman kritik"
    ],
    help: null
  },
  {
    id: "q3",
    dimension: "systemReadiness",
    text: "Bugünkü arayüzünüz hangi yapıya daha yakın?",
    options: [
      "Sayfaya özel, birbirine bağlı ekranlar",
      "Ortak görsel bloklar var ama davranışları sayfaya bağlı",
      "Yeniden kullanılabilir bileşenler ve tanımlı durumlar var",
      "Bileşenlerin girdileri, izinleri ve durumları açık bir katalogda tanımlı"
    ],
    help: {
      label: "Bileşen kataloğu ne demek?",
      body: "Bir bileşenin ne gösterebildiğini, hangi girdileri aldığını, hangi durumlarda çalıştığını ve kimlerin kullanabildiğini tanımlayan güncel envanter."
    }
  },
  {
    id: "q4",
    dimension: "systemReadiness",
    text: "Sistem, kullanıcı için o anda neyin önemli olduğunu hangi doğrulanmış sinyallerden anlayabilir?",
    options: [
      "Bulunduğu sayfa dışında anlamlı bir sinyal yok",
      "Rol, plan veya hesap bilgisi",
      "Bunlara ek olarak canlı ürün durumu ve kullanıcı olayları",
      "Açık kullanıcı amacı, canlı durum, izin verilen geçmiş ve yetkiler"
    ],
    help: {
      label: "Doğrulanmış sinyal ne demek?",
      body: "Sistemin gerçekten erişebildiği, güncel, izinli ve kaynağı belli kullanıcı veya ürün bilgisi."
    }
  },
  {
    id: "q5",
    dimension: "controlSafety",
    text: "Yüzey yanlış kurulduğunda kullanıcı ne kadar kontrol sahibi?",
    options: [
      "Neden değiştiğini göremez; sabit bir geri dönüş yolu yok",
      "Geri çıkabilir veya baştan başlayabilir",
      "Nedenini görür; amacı değiştirebilir veya sabit ekrana dönebilir",
      "Önizleyebilir, düzenleyebilir, sıfırlayabilir ve kalıcı bir alternatif kullanabilir"
    ],
    help: null
  },
  {
    id: "q6",
    dimension: "controlSafety",
    text: "Bu yüzeyden kritik bir işlem başlatıldığında hangi korumalar var?",
    options: [
      "İşlem doğrudan çalışır",
      "Standart bir onay ekranı gösterilir",
      "İzin kontrolü, işlem özeti ve geri alma ya da işlem kaydı vardır",
      "Kritik işlem yoktur; veya yalnız onaylı işlemler önizleme, izin, politika ve denetim kaydıyla çalışır"
    ],
    help: {
      label: "Kritik işlem ne demek?",
      body: "Para, veri, erişim, müşteri iletişimi veya geri alınması zor bir durum üzerinde değişiklik yapan işlem."
    }
  },
  {
    id: "q7",
    dimension: "discoveryResilience",
    text: "Ürünün yapabildikleri, ana menüden bağımsız olarak ne kadar tanımlı?",
    options: [
      "Güncel bir envanter yok",
      "Dokümantasyonda veya ekip bilgisinde dağınık halde",
      "Sahibi ve hedef kitlesi tanımlı, güncel bir özellik kataloğu var",
      "Katalog güncel, aranabilir ve rol, izin ve önkoşullarla bağlantılı"
    ],
    help: null
  },
  {
    id: "q8",
    dimension: "discoveryResilience",
    text: "Bir özellik o anki yüzeyde görünmüyorsa kullanıcı onu nasıl bulabilir?",
    options: [
      "Ancak adını biliyorsa sorar veya desteğe yazar",
      "Dokümantasyon ya da aramada bulabilir",
      "Ekrandan bağımsız, gezilebilir bir ürün içi merkezden keşfedebilir",
      "Hem gezilebilir katalogdan hem bağlama uygun yönlendirmeden keşfedebilir; daha önce gördüğü işe geri dönebilir"
    ],
    help: null
  }
]);

/** Public profile names, keyed by the profile ids in ./scoring.js. */
export const PROFILE_NAMES = deepFreeze({
  valueFit: "Değer uyumu",
  systemReadiness: "Sistem hazırlığı",
  controlSafety: "Kontrol ve güvenlik",
  discoveryResilience: "Keşif dayanıklılığı"
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
 * The A5 summary already carries the "Bu bir production onayı değildir." sentence that
 * SCORING.md requires appended to every A5 body, so the renderer appends nothing.
 */
export const ARCHETYPE_CONTENT = deepFreeze({
  problem_seeking_genui: {
    title: "ÖNCE GÖREV, SONRA ARAYÜZ",
    summary: "Uyarlama fikri var. Değişken bir çalışma yüzeyinin çözeceği ana iş henüz net değil.",
    experiment: "Tek bir kullanıcı görevini seçin. Rol veya canlı durum değiştiğinde gereken adımlar gerçekten değişiyor mu, önce bunu gözlemleyin."
  },
  idea_ready_ground_not: {
    title: "SENARYO NET, ZEMİN SIRADA",
    summary: "Kullanım senaryosu var. Bileşen, bağlam veya kullanıcı kontrolü katmanı bugün doğrulanmış değil.",
    experiment: "Mevcut ve güvenilir bileşenlerle, kritik işlem içermeyen, sabit ekrana dönüşü olan tek bir görev prototipi kurun."
  },
  composition_ready_catalog_blind: {
    title: "KOMPOZİSYONA YAKIN, KATALOG KÖRÜ",
    summary: "Yüzeyiniz değişmeye hazır. Özellik kataloğunuz henüz değil.",
    experiment: "Navigasyonu uyarlamadan önce menüden bağımsız, aranabilir bir capability kataloğu ve geri bulma yolu tasarlayın."
  },
  pilot_ground_discovery_partial: {
    title: "PİLOT ZEMİNİ VAR, KEŞİF YARIM",
    summary: "Dar ve geri döndürülebilir bir deney konuşulabilir. En az bir alanda kanıt hâlâ kısmi.",
    experiment: "Tek bir görevi uyarlayın; görev başarısı, sabit ekrana dönüş ve görünmeyen capability keşfini birlikte ölçün."
  },
  controlled_trial_ground: {
    title: "KONTROLLÜ DENEME ZEMİNİ",
    summary: "Yanıtlarınıza göre dar, ölçülebilir ve geri döndürülebilir bir deneme için zemin var. Bu bir production onayı değildir.",
    experiment: "Yetkileri sınırlandırılmış tek bir görevde, kalıcı alternatif yüzeyi koruyarak kontrollü deneme yapın."
  }
});

/**
 * Strength copy. `fallback` replaces the strength module when the highest answer is 0,
 * which the result object signals with `strengthIsFallback`.
 */
export const STRENGTH_COPY = deepFreeze({
  q1: "Değişken bir yüzey için gerçek bir kullanım farkı görüyorsunuz.",
  q2: "Uyarlanacak iş, kozmetik değil; ürünün ana değerine yakın.",
  q3: "Arayüzünüz yeniden kullanılabilir ve tanımlı parçalara dayanıyor.",
  q4: "Sisteminiz yüzeyi güvenilir bağlam sinyalleriyle yönlendirebilir.",
  q5: "Kullanıcı yüzeyi anlayabilir, değiştirebilir ve geri dönebilir.",
  q6: "Kritik işlemler izin, önizleme ve kayıt katmanlarıyla korunuyor.",
  q7: "Capability kataloğunuz menü yapısından bağımsız düşünülmüş.",
  q8: "Görünmeyen işler yeniden bulunabilir kalıyor.",
  fallback: "İlk kazanımınız net: hangi temelin önce kurulması gerektiği artık görünür."
});

/** Recommendation copy for the two priority gaps. */
export const RECOMMENDATION_COPY = deepFreeze({
  q1: "Uyarlama kararını rol etiketine değil, gerçekten değişen bir kullanıcı görevine bağlayın.",
  q2: "Ana akışı yeniden kurmadan önce düşük riskli ama tekrarlanan tek bir işi doğrulayın.",
  q3: "Bileşenlerin girdilerini, durumlarını ve izinlerini makinece okunabilir bir katalogda tanımlayın.",
  q4: "Yüzey kararında kullanılan bağlamı güvenilir, izinli ve güncel sinyallerle sınırlandırın.",
  q5: "Neden değiştiğini gösterin; düzenleme, sıfırlama ve sabit yüzeye dönüş ekleyin.",
  q6: "Kritik işlemlerde izin kontrolü, açık özet, onay ve geri alma ya da denetim kaydı kurun.",
  q7: "Capability envanterini ana menüden bağımsız, güncel ve aranabilir hale getirin.",
  q8: "Ekranda olmayan capability'ler için gezilebilir bir ürün içi merkez ve bağlamsal geri bulma yolu sağlayın."
});

/**
 * The handful of public strings the renderer produces at runtime. Everything else is
 * authored directly in index.html, so each string still exists exactly once.
 * Share and card copy is added in Phase 3.
 */
export const UI_COPY = deepFreeze({
  progress: "{current} / 8",
  next: "Devam",
  finish: "Sonucumu göster",
  unansweredError: "Devam etmek için bugün çalışan durumu seçin.",
  resultError: "Sonuç hesaplanamadı. Yanıtlarınızı kontrol edip yeniden deneyin.",
  copySuccess: "Bağlantı kopyalandı.",
  copyFailure: "Bağlantı kopyalanamadı. Adres çubuğundaki bağlantıyı paylaşabilirsiniz.",
  cardError: "Kart oluşturulamadı. Sonuç ekranının görüntüsünü alabilir veya bağlantıyı paylaşabilirsiniz.",
  shareFailure: "Paylaşım açılamadı. Sonuç ekranının görüntüsünü alabilir veya bağlantıyı paylaşabilirsiniz."
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
  nextLabelSource: "Bir sonraki küçük deney",
  footerStrong: "Yazarlı öz değerlendirme.",
  footerNote: "Teknik audit değildir.",
  footerUrlTop: "games.userguiding.com/",
  footerUrlBottom: "generative-ui-checkup/"
});

/** Native share sheet copy. `{archetype}` is replaced with the archetype title. */
export const SHARE_COPY = deepFreeze({
  title: "Generative UI Check-up sonucum",
  text: "Benim sonucum: {archetype}. Aynı ürüne bakan ekip arkadaşım da aynı sonucu alacak mı?",
  url: "https://games.userguiding.com/generative-ui-checkup/"
});
