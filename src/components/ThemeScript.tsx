/**
 * Tema ilk boyamadan önce uygulanır; koyu temayı seçen kullanıcı
 * bir kare beyaz ekran görmesin.
 */
export default function ThemeScript() {
  const code = `(function(){try{
    var t = localStorage.getItem('kb-theme');
    if (t !== 'light' && t !== 'dark') {
      t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    document.documentElement.setAttribute('data-theme', t);
  }catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
