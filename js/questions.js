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
    text: "Üründe aynı işi yapmaya çalışan yeni ve deneyimli iki kullanıcıyı düşünün. İhtiyaç duydukları ekran ne kadar farklı olmalı?",
    options: [
      "Değişmez: ikisi de aynı adımları ve aynı ekranı kullanır",
      "Yapı aynı kalır; yalnız içerik veya öncelik değişir",
      "Rol ya da ürün durumu bazı bileşenleri ve sıralamayı değiştirir",
      "Kullanıcının amacı, rolü ve canlı veriler ekranın büyük bölümünü değiştirmelidir"
    ],
    help: {
      label: "Değişken çalışma ekranı ne demek?",
      body: "Generative UI, aynı sabit ekranı herkese göstermek yerine kullanıcının amacına ve mevcut durumuna göre gerekli bileşenleri o anda bir araya getirir. Değer, yalnız içerik değiştiğinde değil, görevi tamamlama biçimi gerçekten değiştiğinde oluşur."
    }
  },
  {
    id: "q2",
    dimension: "valueFit",
    text: "Generative UI ile uyarlamak istediğiniz bu görev, activation, retention veya revenue sonuçları için ne kadar önemli?",
    options: [
      "Nadiren yapılır; etkisi daha çok görseldir",
      "Tekrarlanır ama kullanıcı veya iş sonucu üzerindeki etkisi düşüktür",
      "Sık yapılır, birkaç adımdan oluşur ve önemli bir sonucu etkiler",
      "Ürünün ana işlerinden biridir; activation, retention veya revenue için kritiktir"
    ],
    help: {
      label: "Kritik kullanıcı görevi ne demek?",
      body: "Kullanıcının üründen değer almasını doğrudan etkileyen iştir. Örneğin ilk kurulumu tamamlamak activation'ı, düzenli rapor hazırlamak retention'ı, plan yükseltmek ise revenue'yu etkileyebilir."
    }
  },
  {
    id: "q3",
    dimension: "systemReadiness",
    text: "Yarın bir model ürün ekranınızı oluşturacak olsa, kullanabileceği bileşen sistemi ne kadar hazır?",
    options: [
      "Ekranlar sayfaya özel yazılmış; parçalar birbirine sıkı bağlıdır",
      "Ortak görsel bloklar vardır; davranışları hâlâ sayfaya bağlıdır",
      "Yeniden kullanılabilir bileşenler ve tanımlı durumlar vardır",
      "Bileşen girdileri, durumları, izinleri ve kullanım kuralları güncel bir katalogda tanımlıdır"
    ],
    help: {
      label: "Bileşen sözleşmesi ne demek?",
      body: "Bir bileşenin hangi veriyi alabileceğini, hangi durumlarda çalıştığını, kimlerin kullanabildiğini ve hata halinde ne göstereceğini açıklayan teknik sözleşmedir. Model ancak bu sınırlar açıksa güvenli bir ekran kurabilir."
    }
  },
  {
    id: "q4",
    dimension: "systemReadiness",
    text: "Generative UI, kullanıcıya o anda doğru ekranı göstermek için hangi güvenilir bağlam sinyallerini kullanabilir?",
    options: [
      "Kullanıcının bulunduğu sayfa dışında anlamlı bir sinyal yoktur",
      "Rol, plan veya hesap bilgisi kullanılabilir",
      "Bunlara ek olarak canlı ürün durumu ve yakın tarihli kullanıcı hareketleri kullanılabilir",
      "Açık kullanıcı amacı, canlı durum, izin verilen geçmiş ve yetkiler birlikte kullanılabilir"
    ],
    help: {
      label: "Bağlam sinyali ne demek?",
      body: "Kullanıcının rolü, planı, açık amacı, son hareketleri veya hesabın canlı durumu gibi ekran kararını etkileyen bilgidir. Sinyal güncel, izinli ve kaynağı belli değilse kişiselleştirme güvenilir olmaz."
    }
  },
  {
    id: "q5",
    dimension: "controlSafety",
    text: "Generative UI yanlış veya alakasız bir ekran gösterirse kullanıcı nasıl yoluna devam eder?",
    options: [
      "Ekranın neden değiştiğini göremez; sabit bir geri dönüş yolu yoktur",
      "Geri çıkabilir veya akışı baştan başlatabilir",
      "Değişikliğin nedenini görür; amacını değiştirebilir veya sabit ekrana dönebilir",
      "Ekranı önizleyebilir, düzenleyebilir, sıfırlayabilir ve kalıcı bir alternatif kullanabilir"
    ],
    help: {
      label: "Güvenli geri dönüş ne demek?",
      body: "Üretilen ekran işe yaramadığında kullanıcının dönebileceği güvenilir alternatiftir. Sabit ürün ekranı, önceki görünüm veya sıfırlama seçeneği bu geri dönüşü sağlayabilir."
    }
  },
  {
    id: "q6",
    dimension: "controlSafety",
    text: "Üretilen ekrandan ödeme, veri silme veya yetki değiştirme gibi kritik bir işlem başlatılırsa ne olur?",
    options: [
      "İşlem doğrudan çalışır",
      "Standart bir onay ekranı gösterilir",
      "İzin kontrolü ve işlem özeti gösterilir; geri alma veya işlem kaydı vardır",
      "Yalnız önceden onaylanmış işlemler, önizleme, izin, kurallar ve denetim kaydıyla çalışır"
    ],
    help: {
      label: "Kritik işlem ne demek?",
      body: "Para, veri, erişim veya müşteri iletişimi üzerinde değişiklik yapan ve geri alınması zor olabilen işlemdir. Ödeme almak, veri silmek, kullanıcı davet etmek veya yetki değiştirmek bu gruba girer."
    }
  },
  {
    id: "q7",
    dimension: "discoveryResilience",
    text: "Sol menü yarın kaybolsa, sistem ürününüzün neler yapabildiğini nereden bilir?",
    options: [
      "Ürünün yapabildiği işleri gösteren güncel bir envanter yoktur",
      "Bilgi dokümantasyonda veya ekip içinde dağınık halde durur",
      "Sahibi ve hedef kitlesi tanımlı, güncel bir özellik kataloğu vardır",
      "Katalog güncel ve aranabilirdir; rol, izin ve ön koşullarla bağlantılıdır"
    ],
    help: {
      label: "Özellik kataloğu ne demek?",
      body: "Ürünün yapabildiği işleri menü yapısından bağımsız olarak tanımlayan güncel envanterdir. Her özelliğin hedef kullanıcısı, izinleri, ön koşulları ve sahibi burada yer alır."
    }
  },
  {
    id: "q8",
    dimension: "discoveryResilience",
    text: "Generative UI bir özelliği o anda göstermediyse kullanıcı onu daha sonra nasıl bulur?",
    options: [
      "Ancak adını biliyorsa arar veya support ekibine sorar",
      "Dokümantasyonda ya da aramada bulabilir",
      "Ekrandan bağımsız, gezilebilir bir ürün içi merkezden keşfedebilir",
      "Hem gezilebilir katalogdan hem bağlama uygun yönlendirmeden keşfedebilir; daha önce gördüğü işe geri dönebilir"
    ],
    help: {
      label: "Keşfedilebilirlik ne demek?",
      body: "Bir özellik o an ekranda görünmese bile kullanıcının onu daha sonra arayıp bulabilmesidir. Aranabilir ürün merkezi, bağlama uygun yönlendirme ve son kullanılanlara dönüş bu dayanıklılığı sağlar."
    }
  }
]);

/** Public profile names, keyed by the profile ids in ./scoring.js. */
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
export const RECOMMENDATION_COPY = deepFreeze({
  q1: "Tek bir kullanıcı görevi seçin; rol veya ürün durumu değiştiğinde gerekli ekranın gerçekten değiştiğini kullanıcı görüşmeleriyle doğrulayın.",
  q2: "Pilotu activation, retention veya revenue ile ilişkili tek bir ölçülebilir sonuca bağlayın.",
  q3: "Pilot kapsamındaki bileşenlerin girdilerini, durumlarını, izinlerini ve geri dönüşlerini sistemin okuyabileceği biçimde tanımlayın.",
  q4: "Generative UI sisteminin kullanabileceği bağlam sinyallerini güvenilir, güncel, izinli ve denetlenebilir bir listeyle sınırlandırın.",
  q5: "Üretilen ekranın neden gösterildiğini açıklayın; düzenleme, sıfırlama ve sabit ekrana dönüş seçenekleri ekleyin.",
  q6: "Ödeme, veri silme ve yetki değişikliği gibi işlemleri izin kontrolü, açık özet, onay ve denetim kaydı olmadan çalıştırmayın.",
  q7: "Özellik kataloğunu ana menüden ayırın; her özellik için sahip, hedef kullanıcı, izin ve ön koşul bilgisi ekleyin.",
  q8: "Görünmeyen özellikler için aranabilir bir ürün merkezi, bağlama uygun yönlendirme ve son kullanılanlara dönüş yolu sağlayın."
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
  desktopPrepared: "Post metni kopyalandı ve sonuç karnesi indirildi. LinkedIn'de görseli posta ekleyip metni yayımlayabilirsiniz.",
  copyFailure: "Post metni kopyalanamadı. Metni kutudan elle kopyalayabilirsiniz; sonuç karneniz yine indirilecek.",
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

/** Native share sheet copy. `{archetype}` is replaced with the archetype title. */
export const SHARE_COPY = deepFreeze({
  title: "Generative UI Check-up sonucum",
  text: "Generative UI Check-up sonucum: {archetype}\n\nBugünkü güçlü temelim:\n{strength}\n\nİlk pilot adımım:\n{experiment}\n\nSizce ürününüz Generative UI için ne kadar hazır?\n{url}",
  url: "https://games.userguiding.com/generative-ui-checkup/?utm_source=linkedin&utm_medium=organic_social&utm_campaign=generative_ui_checkup&utm_content={archetype_id}"
});

export const PARTNER_COPY = deepFreeze({
  heading: "Hazırlayanlar",
  softCommitment: "AI, startup'lar ve yeni ekonomi üzerine iki haftada bir yayımlanan bağımsız bülten.",
  userGuiding: "Ürün ekiplerinin kod yazmadan onboarding ve ürün içi deneyimler oluşturmasını sağlayan product adoption platformu."
});
