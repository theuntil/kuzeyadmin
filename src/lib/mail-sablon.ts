import "server-only";

/**
 * MAİL ŞABLONU
 *
 * Yapı (yukarıdan aşağı):
 *   1. Büyük görsel — üzerinde logolar
 *   2. Başlık
 *   3. İçerik
 *   4. İmza ve alt bilgi
 *
 * ┌─ LOGOLAR GÖRSELİN ÜSTÜNDE ⚠️ ─────────────────────────────┐
 * │ Bizim logo · × · karşı kurumun logosu — ortada, yan yana.  │
 * │ Karşı logo yoksa yalnızca bizimki, yine ortada.            │
 * │                                                              │
 * │ Görsel varken logolar onun üzerine biniyor ve arkalarına    │
 * │ yarı saydam beyaz bir tablet konuyor: fotoğraf koyu da      │
 * │ olsa açık da olsa logo okunur kalıyor.                      │
 * └──────────────────────────────────────────────────────────────┘
 *
 * ┌─ MAİLDE DARK MODE ⚠️ ─────────────────────────────────────┐
 * │ `prefers-color-scheme` medya sorgusu ekleniyor ama BUNA    │
 * │ GÜVENİLMİYOR: Gmail web ve Outlook onu yok sayar.          │
 * │ Bu yüzden temel renkler satır içi stilde AÇIK TEMA olarak  │
 * │ yazılıyor; medya sorgusu yalnızca destekleyen istemcilerde  │
 * │ (Apple Mail, iOS) devreye giriyor.                          │
 * │                                                              │
 * │ Logo seçimi de aynı mantıkla: karanlık temada okunabilen    │
 * │ sürüm varsayılan. Mail istemcisinin temasını sunucuda       │
 * │ bilemeyiz.                                                   │
 * └──────────────────────────────────────────────────────────────┘
 */

const C = {
  bg: "#f2f3f5", card: "#ffffff", text: "#0f1113",
  muted: "#5c6368", line: "#e4e7ea",
};

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function paragraflar(metin: string): string {
  return metin
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) =>
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.75;color:${C.text};">${
        esc(b).replace(/\n/g, "<br>")
      }</p>`)
    .join("");
}

export interface MailGovde {
  subject: string;
  heading: string | null;
  body: string;
  isHtml: boolean;
  /** Karşı kurumun logosu — tam URL */
  partnerLogo: string | null;
  /** Şablonun üstündeki büyük görsel — tam URL */
  heroImage: string | null;
  /** Bizim logomuz — koyu zeminde okunan sürüm tercih edilir */
  ourLogo: string | null;
  brand: {
    name: string | null; site_url: string | null;
    footer_note: string | null; signature_html: string | null;
  };
}

export function mailHtml(g: MailGovde): string {
  const marka = g.brand.name ?? "Kuzeybatı Haber";
  const govde = g.isHtml ? g.body : paragraflar(g.body);

  const baslik = g.heading
    ? `<h1 style="margin:0 0 18px;font-size:22px;font-weight:700;line-height:1.3;color:${C.text};">${esc(g.heading)}</h1>`
    : "";

  /* ---- Logo şeridi ---- */

  /*
   * ⚠ LOGO BÜYÜTÜLMÜYOR.
   *
   * Önce `height="34"` sabitti. Logo dosyası küçükse (48px gibi)
   * mail istemcisi onu 34px'e indirmek yerine bazen genişletiyor
   * ve görüntü "yağlı boya" gibi bulanıklaşıyordu.
   *
   * `max-height` + `height:auto` ile: logo kendi doğal boyutunda
   * kalıyor, yalnızca çok büyükse küçültülüyor. Asla
   * büyütülmüyor.
   *
   * `image-rendering` da ekleniyor: küçültme yapan istemciler
   * yumuşak ölçekleme kullansın, keskin piksel değil.
   */
  const LOGO_STIL =
    "max-height:36px;height:auto;width:auto;max-width:180px;" +
    "border:0;display:block;image-rendering:auto;";

  const bizim = g.ourLogo
    ? `<img src="${esc(g.ourLogo)}" alt="${esc(marka)}" style="${LOGO_STIL}">`
    : `<span style="font-size:18px;font-weight:700;color:${C.text};white-space:nowrap;">${esc(marka)}</span>`;

  const logoSeridi = g.partnerLogo
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
         <tr>
           <td style="padding:0 14px;vertical-align:middle;">${bizim}</td>
           <td style="padding:0 4px;font-size:16px;color:${C.muted};vertical-align:middle;">&times;</td>
           <td style="padding:0 14px;vertical-align:middle;">
             <img src="${esc(g.partnerLogo)}" alt="" style="${LOGO_STIL}">
           </td>
         </tr>
       </table>`
    : `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
         <tr><td style="vertical-align:middle;">${bizim}</td></tr>
       </table>`;

  /*
   * Görsel varsa logolar ONUN ÜZERİNDE duruyor.
   * E-posta istemcilerinin çoğu `position:absolute` desteklemiyor;
   * bu yüzden görsel bir hücrenin ARKA PLANI olarak veriliyor ve
   * logolar aynı hücrenin içine yerleştiriliyor. Outlook için
   * ayrıca `background` özniteliği de yazılıyor.
   */
  /*
   * ⚠ LOGO GÖRSELİN TAM ORTASINDA — altında değil.
   *
   * Bunun için görsel bir hücrenin ARKA PLANI olarak veriliyor
   * ve logolar aynı hücrenin içine, dikey ortalı yerleştiriliyor.
   * `position:absolute` kullanılmıyor: e-posta istemcilerinin
   * çoğu desteklemiyor.
   *
   * Outlook `background-image` okumadığı için ayrıca `background`
   * özniteliği de yazılıyor — ikisi birlikte tüm istemcileri
   * kapsıyor.
   *
   * Arkada beyaz tablet YOK. Bunun yerine logoların arkasına
   * çok hafif bir karartma konuyor: açık renkli bir fotoğrafta
   * beyaz logo kaybolmasın diye. Yamalı görünmüyor çünkü tüm
   * şeridi kaplıyor, kutu değil.
   */
  const ust = g.heroImage
    ? `<tr>
         <td background="${esc(g.heroImage)}" height="220" valign="middle"
             style="height:220px;background-image:url('${esc(g.heroImage)}');
                    background-size:cover;background-position:center;
                    background-repeat:no-repeat;text-align:center;padding:0 20px;">
           <!--[if gte mso 9]>
           <v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false"
                   style="width:640px;height:220px;">
             <v:fill type="frame" src="${esc(g.heroImage)}" />
             <v:textbox inset="0,0,0,0"><div>
           <![endif]-->
           ${logoSeridi}
           <!--[if gte mso 9]></div></v:textbox></v:rect><![endif]-->
         </td>
       </tr>`
    : `<tr><td style="padding:26px 26px 0;text-align:center;">${logoSeridi}</td></tr>`;

  const imza = g.brand.signature_html
    ? `<div style="margin-top:26px;padding-top:18px;border-top:1px solid ${C.line};font-size:14px;line-height:1.7;color:${C.muted};">${g.brand.signature_html}</div>`
    : "";

  return `<!doctype html>
<html lang="tr"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${esc(g.subject)}</title>
<style>
  /* Yalnızca destekleyen istemcilerde çalışır (Apple Mail, iOS).
     Gmail ve Outlook yok sayar — satır içi stiller esas. */
  @media (prefers-color-scheme: dark) {
    .kb-bg   { background:#0b0c0d !important; }
    .kb-card { background:#141618 !important; }
    .kb-text, .kb-text p, .kb-text h1 { color:#f1f3f4 !important; }
    .kb-muted { color:#9aa1a6 !important; }
    .kb-line { border-color:#262a2d !important; }
  }
  /* Dar ekranda kenar boşluklarını daralt.
     Görsel artık gerçek <img> ve kendi oranını koruyor;
     ayrıca yükseklik kuralı gerekmiyor. */
  @media only screen and (max-width:600px) {
    .kb-pad { padding:24px 18px !important; }
  }
</style>
</head>
<body class="kb-bg" style="margin:0;padding:24px 12px;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;">
  <tr><td>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
           class="kb-card" style="background:${C.card};border-radius:16px;overflow:hidden;">
      ${ust}
      <tr><td class="kb-pad kb-text" style="padding:32px 30px;">
        ${baslik}${govde}${imza}
      </td></tr>
    </table>
  </td></tr>
  <tr><td class="kb-muted" style="padding:20px 10px 0;text-align:center;color:${C.muted};font-size:12px;line-height:1.7;">
    ${esc(g.brand.footer_note ?? marka)}
    ${g.brand.site_url
      ? `<br><a href="${esc(g.brand.site_url)}" style="color:${C.muted};text-decoration:underline;">${esc(g.brand.site_url.replace(/^https?:\/\//, ""))}</a>`
      : ""}
  </td></tr>
</table>
</body></html>`;
}
