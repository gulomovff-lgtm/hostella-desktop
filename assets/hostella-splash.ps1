# Заставка Hostella при установке и обновлении (13.11.2026).
# Вместо серого окна установщика — своё окно: большой логотип, крупная
# надпись, плавно сменяющиеся подписи этапов и мягкая бирюзовая полоса.
#   -Mode install — первая установка: прячет окно установщика (-WatchPid),
#                   гаснет, когда установщик закончил.
#   -Mode update  — обновление: держится, пока молча ставится новая версия,
#                   гаснет, когда Hostella открылась заново (или через 3 мин).
param(
  [string]$Mode = 'install',
  [int]$WatchPid = 0,
  [string]$Logo = '',
  [string]$Version = '',
  [string]$Snapshot = '',   # проверка: кадр в PNG без показа окна
  [double]$At = 1.5
)
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

public class HostellaSplash : Form {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  delegate bool EnumProc(IntPtr h, IntPtr l);

  readonly string mode; readonly int watchPid; readonly string version;
  readonly Image logo; readonly string[] lines;
  readonly Timer timer = new Timer();
  readonly DateTime started = DateTime.Now;
  int lineIdx = 0; double lineAt = 0; double t = 0; bool closing = false; double closeAt = 0;
  bool sawNew = false;
  Bitmap girih; bool sawSetup = false;
  double lastHide = -1, lastCheck = -1;

  static readonly Color Ink = Color.FromArgb(26, 60, 64);      // --nav-bg #1a3c40
  static readonly Color Muted = Color.FromArgb(100, 116, 139); // slate-500
  static readonly Color Soft = Color.FromArgb(148, 163, 184);  // slate-400
  static readonly Color Track = Color.FromArgb(241, 245, 249); // slate-100
  static readonly Color Teal = Color.FromArgb(20, 184, 166);   // teal-500
  static readonly Color Orange = Color.FromArgb(232, 140, 64); // акцент #e88c40

  public HostellaSplash(string mode, int watchPid, string logoPath, string version) {
    this.mode = mode; this.watchPid = watchPid; this.version = version;
    try { if (!string.IsNullOrEmpty(logoPath)) logo = Image.FromStream(new System.IO.MemoryStream(System.IO.File.ReadAllBytes(logoPath))); } catch { }
    lines = mode != "install"
      ? new[] { "Обновляем кассы…", "Переносим настройки…", "Обновляем шахматку номеров…", "Проверяем e-mehmon и кадастр…", "Готовим отчёты…", "Запускаем новую версию…" }
      : new[] { "Распаковываем Hostella…", "Готовим шахматку номеров…", "Настраиваем кассу…", "Подключаем e-mehmon…", "Настраиваем кадастр…", "Создаём ярлык на рабочем столе…", "Почти готово…" };
    Text = "Hostella";
    FormBorderStyle = FormBorderStyle.None;
    StartPosition = FormStartPosition.CenterScreen;
    Size = new Size(560, 380);
    BackColor = Color.White;
    ShowInTaskbar = true;
    TopMost = true;
    Opacity = 0;
    DoubleBuffered = true;
    SetStyle(ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.UserPaint, true);
    try { Icon = Icon.ExtractAssociatedIcon(Process.GetCurrentProcess().MainModule.FileName); } catch { }
    using (var p = Rounded(new Rectangle(0, 0, Width, Height), 22)) Region = new Region(p);
    girih = BuildGirih(760);
    timer.Interval = 16;
    timer.Tick += Tick;
    timer.Start();
  }

  static GraphicsPath Rounded(Rectangle r, int rad) {
    var p = new GraphicsPath(); int d = rad * 2;
    p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
    p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
    p.CloseFigure(); return p;
  }
  // Гирих экрана входа: восьмиконечные звёзды с кольцами, бледно, в цветах
  // программы. Рисуется один раз; на экране только поворачивается.
  static Bitmap BuildGirih(int D) {
    var bmp = new Bitmap(D, D);
    using (var g = Graphics.FromImage(bmp)) {
      g.SmoothingMode = SmoothingMode.AntiAlias;
      int S = 76; double r = S * 0.46, k = 0.62;
      using (var pt = new Pen(Color.FromArgb(70, 20, 184, 166), 1.4f))
      using (var po = new Pen(Color.FromArgb(60, 232, 140, 64), 1.2f))
      using (var pc = new Pen(Color.FromArgb(30, 26, 60, 64), 1f)) {
        int row = 0;
        for (int y = 0; y < D + S; y += S, row++)
          for (int x = (row % 2) * S / 2; x < D + S; x += S) {
            var star = new PointF[16];
            for (int i = 0; i < 16; i++) {
              double a = Math.PI / 8 * i - Math.PI / 2, rr = i % 2 == 1 ? r * k : r;
              star[i] = new PointF((float)(x + Math.Cos(a) * rr), (float)(y + Math.Sin(a) * rr));
            }
            g.DrawPolygon(((x / S + row) % 2 == 0) ? pt : po, star);
            g.DrawEllipse(pc, (float)(x - r * 0.38), (float)(y - r * 0.38), (float)(r * 0.76), (float)(r * 0.76));
          }
      }
    }
    return bmp;
  }

  static double Ease(double k) { k = Math.Max(0, Math.Min(1, k)); return 1 - Math.Pow(1 - k, 3); }

  void Tick(object s, EventArgs e) {
    t = (DateTime.Now - started).TotalSeconds;
    if (!closing) Opacity = Ease(t / 0.45);
    else { double k = (t - closeAt) / 0.4; Opacity = 1 - Ease(k); if (k >= 1) { timer.Stop(); Close(); return; } }
    if (t - lineAt > 2.2 && lineIdx < lines.Length - 1) { lineIdx++; lineAt = t; }
    // Окно стандартного установщика — прячем, своё уже на экране
    if (mode == "install" && watchPid > 0 && t - lastHide > 0.15) { lastHide = t; HideInstaller(); }
    if (!closing && t - lastCheck > 0.4) { lastCheck = t; if (Done()) { closing = true; closeAt = t; } }
    Invalidate();
  }

  void HideInstaller() {
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pid == (uint)watchPid && IsWindowVisible(h)) ShowWindow(h, 0);
      return true;
    }, IntPtr.Zero);
  }

  bool Done() {
    if (t > 180) return true;
    if (mode == "install") {
      if (watchPid <= 0) return t > 8;
      try { Process.GetProcessById(watchPid); return false; } catch { return t > 1.5; }
    }
    if (mode == "update-quit") {
      bool running = false;
      foreach (var p in Process.GetProcesses()) {
        try { var n = p.ProcessName; if (n.StartsWith("Hostella-Setup") || n.StartsWith("Hostella Setup") || n == "installer") { running = true; break; } } catch { }
      }
      if (running) sawSetup = true;
      return sawSetup ? !running : t > 15;
    }
    // update: новая Hostella запущена после заставки и показала окно
    foreach (var p in Process.GetProcessesByName("Hostella")) {
      try {
        if (p.StartTime > started.AddSeconds(2) && p.MainWindowHandle != IntPtr.Zero) { if (sawNew) return true; sawNew = true; }
      } catch { }
    }
    return false;
  }

  // Кадр в картинку на момент at секунд (для проверки вида, окно не показывается)
  public void Snapshot(string path, double at) {
    timer.Stop(); t = at; lineIdx = Math.Min(lines.Length - 1, (int)(at / 2.2)); lineAt = lineIdx * 2.2;
    CreateControl();
    using (var bmp = new Bitmap(Width, Height)) {
      using (var g = Graphics.FromImage(bmp)) { g.Clear(Color.White); OnPaint(new PaintEventArgs(g, new Rectangle(0, 0, Width, Height))); }
      bmp.Save(path, System.Drawing.Imaging.ImageFormat.Png);
    }
  }

  protected override void OnPaint(PaintEventArgs e) {
    var g = e.Graphics;
    g.SmoothingMode = SmoothingMode.AntiAlias;
    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
    g.TextRenderingHint = TextRenderingHint.ClearTypeGridFit;
    int W = ClientSize.Width, H = ClientSize.Height;
    using (var p = Rounded(new Rectangle(0, 0, W - 1, H - 1), 22))
    using (var pen = new Pen(Color.FromArgb(226, 232, 240))) g.DrawPath(pen, p);

    // Фон: гирих медленно вращается по кругу, к центру — белая дымка
    if (girih != null) {
      var st = g.Save();
      g.TranslateTransform(W / 2f, 150f);
      g.RotateTransform((float)(t * 5));
      g.DrawImage(girih, -girih.Width / 2, -girih.Height / 2);
      g.Restore(st);
      using (var path = new GraphicsPath()) {
        path.AddEllipse(-60, -40, W + 120, H + 60);
        using (var pb = new PathGradientBrush(path)) {
          pb.CenterPoint = new PointF(W / 2f, H / 2f + 10);
          pb.CenterColor = Color.FromArgb(250, 255, 255, 255);
          pb.SurroundColors = new[] { Color.FromArgb(0, 255, 255, 255) };
          pb.FocusScales = new PointF(0.42f, 0.5f);
          g.FillRectangle(pb, 0, 0, W, H);
        }
      }
    }

    // Логотип: появляется с лёгким подъёмом и мягко «дышит»
    if (logo != null) {
      double rise = Ease(t / 0.6);
      double breathe = 1 + 0.015 * Math.Sin(t * 2.2);
      int size = (int)(150 * breathe);
      int lx = (W - size) / 2, ly = 34 + (int)((1 - rise) * 14) - (size - 150) / 2;
      g.DrawImage(logo, new Rectangle(lx, ly, size, (int)(size * logo.Height / (double)logo.Width)));
    }

    var center = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center };
    string title = mode != "install"
      ? ("Обновляем Hostella" + (string.IsNullOrEmpty(version) ? "" : " до " + version))
      : "Устанавливаем Hostella";
    using (var f = new Font("Segoe UI Semibold", 16f))
    using (var b = new SolidBrush(Color.FromArgb((int)(255 * Ease((t - 0.15) / 0.5)), Ink)))
      g.DrawString(title, f, b, new RectangleF(0, 206, W, 34), center);

    // Подписи этапов: плавная смена — уходит вверх, приходит снизу
    double k = Ease((t - lineAt) / 0.45);
    using (var f = new Font("Segoe UI", 10.5f)) {
      if (lineIdx > 0 && k < 1) {
        using (var b = new SolidBrush(Color.FromArgb((int)(255 * (1 - k)), Muted)))
          g.DrawString(lines[lineIdx - 1], f, b, new RectangleF(0, 244 - (float)(k * 10), W, 24), center);
      }
      using (var b = new SolidBrush(Color.FromArgb((int)(255 * k), Muted)))
        g.DrawString(lines[lineIdx], f, b, new RectangleF(0, 244 + (float)((1 - k) * 10), W, 24), center);
    }

    // Полоса: дорожка и бегущий бирюзово-оранжевый отрезок
    int bw = 280, bx = (W - bw) / 2, by = 290, bh = 4;
    using (var tr = new SolidBrush(Track)) using (var p = Rounded(new Rectangle(bx, by, bw, bh), 2)) g.FillPath(tr, p);
    double cyc = (t * 0.55) % 1.0;
    double a = Ease(cyc * 1.25), z = Ease(Math.Max(0, cyc * 1.25 - 0.25));
    int x1 = bx + (int)(z * bw), x2 = bx + (int)(a * bw);
    if (x2 - x1 > 2) {
      var seg = new Rectangle(x1, by, x2 - x1, bh);
      using (var lg = new LinearGradientBrush(seg, Teal, Orange, LinearGradientMode.Horizontal))
      using (var p = Rounded(seg, 2)) g.FillPath(lg, p);
    }

    using (var f = new Font("Segoe UI", 8.5f))
    using (var b = new SolidBrush(Soft))
      g.DrawString((string.IsNullOrEmpty(version) ? "Hostella" : "Hostella " + version) + "  ·  система управления хостелом", f, b, new RectangleF(0, H - 40, W, 20), center);
  }
}
'@
if ($Snapshot) { (New-Object HostellaSplash($Mode, $WatchPid, $Logo, $Version)).Snapshot($Snapshot, $At); return }
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::Run((New-Object HostellaSplash($Mode, $WatchPid, $Logo, $Version)))
