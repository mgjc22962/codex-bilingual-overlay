using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Automation;
using System.Windows.Forms;

namespace CodexBilingualOverlay
{
    internal sealed class OverlayForm : Form
    {
        internal const int WsExTransparent = 0x20;
        internal const int WsExLayered = 0x80000;
        internal const int WsExNoActivate = 0x08000000;
        internal const int WsExToolWindow = 0x80;
        internal const int WmNcHitTest = 0x84;
        internal const int HtTransparent = -1;

        private readonly Label label;

        internal OverlayForm()
        {
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            TopMost = true;
            BackColor = Color.Magenta;
            TransparencyKey = Color.Magenta;
            StartPosition = FormStartPosition.Manual;
            Location = new Point(-32000, -32000);
            Size = new Size(1, 1);

            label = new Label();
            label.AutoSize = false;
            label.BackColor = Color.FromArgb(246, 24, 24, 27);
            label.ForeColor = Color.White;
            label.Font = new Font("Microsoft YaHei UI", 9.5f, FontStyle.Regular, GraphicsUnit.Point);
            label.Padding = new Padding(7, 4, 7, 4);
            label.TextAlign = ContentAlignment.MiddleLeft;
            Controls.Add(label);
        }

        protected override CreateParams CreateParams
        {
            get
            {
                CreateParams value = base.CreateParams;
                value.ExStyle |= WsExTransparent | WsExLayered | WsExNoActivate | WsExToolWindow;
                return value;
            }
        }

        protected override bool ShowWithoutActivation { get { return true; } }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == WmNcHitTest)
            {
                message.Result = (IntPtr)HtTransparent;
                return;
            }
            base.WndProc(ref message);
        }

        internal void ShowTranslation(string text, Rectangle target, string layout)
        {
            Rectangle working = Screen.FromRectangle(target).WorkingArea;
            if (layout == "panel")
            {
                ShowPanel(text, target, working);
                return;
            }
            bool inline = layout == "inline";
            Opacity = 1.0;
            label.Font = new Font("Microsoft YaHei UI", 9.5f, FontStyle.Regular, GraphicsUnit.Point);
            label.Padding = new Padding(7, 4, 7, 4);
            label.TextAlign = ContentAlignment.MiddleLeft;
            int maxWidth = inline
                ? Math.Max(120, Math.Min(420, working.Width - 32))
                : Math.Max(180, Math.Min(720, Math.Min(working.Width - 32, Math.Max(260, target.Width))));
            Size measured = TextRenderer.MeasureText(
                text,
                label.Font,
                new Size(maxWidth - 20, 600),
                TextFormatFlags.WordBreak | TextFormatFlags.NoPrefix);
            int width = Math.Min(maxWidth, Math.Max(90, measured.Width + 16));
            int height = Math.Min(360, Math.Max(28, measured.Height + 10));
            int x = inline ? target.Right + 8 : target.Left;
            int y = inline ? target.Top : target.Bottom + 5;
            if (x + width > working.Right) x = working.Right - width - 8;
            if (x < working.Left) x = working.Left + 8;
            if (y + height > working.Bottom) y = target.Top - height - 5;
            if (y < working.Top) y = working.Top + 8;

            Bounds = new Rectangle(x, y, width, height);
            label.Bounds = new Rectangle(0, 0, width, height);
            label.Text = text;
            if (!Visible) Show();
            NativeMethods.SetWindowPos(
                Handle,
                NativeMethods.HwndTopMost,
                x,
                y,
                width,
                height,
                NativeMethods.SwpNoActivate | NativeMethods.SwpShowWindow);
        }

        private void ShowPanel(string text, Rectangle target, Rectangle working)
        {
            int rightSpace = working.Right - target.Right - 16;
            int leftSpace = target.Left - working.Left - 16;
            int bottomSpace = working.Bottom - target.Bottom - 16;
            int topSpace = target.Top - working.Top - 16;
            int desiredWidth = Math.Min(620, Math.Max(440, working.Width / 3));
            int width;
            int height = Math.Min(working.Height - 32, Math.Max(420, Math.Min(780, target.Height + 120)));
            int x;
            int y;

            if (rightSpace >= 360)
            {
                width = Math.Min(desiredWidth, rightSpace);
                x = target.Right + 16;
                y = Math.Max(working.Top + 16, Math.Min(target.Top, working.Bottom - height - 16));
            }
            else if (leftSpace >= 360)
            {
                width = Math.Min(desiredWidth, leftSpace);
                x = target.Left - width - 16;
                y = Math.Max(working.Top + 16, Math.Min(target.Top, working.Bottom - height - 16));
            }
            else if (bottomSpace >= 300)
            {
                width = Math.Min(Math.Max(360, target.Width), working.Width - 32);
                height = Math.Min(height, bottomSpace);
                x = Math.Max(working.Left + 16, Math.Min(target.Left, working.Right - width - 16));
                y = target.Bottom + 16;
            }
            else if (topSpace >= 300)
            {
                width = Math.Min(Math.Max(360, target.Width), working.Width - 32);
                height = Math.Min(height, topSpace);
                x = Math.Max(working.Left + 16, Math.Min(target.Left, working.Right - width - 16));
                y = target.Top - height - 16;
            }
            else
            {
                HideTranslation();
                return;
            }

            float fontSize = text.Length > 1800 ? 8.0f : (text.Length > 1100 ? 8.75f : 9.5f);
            Opacity = 0.96;
            label.Font = new Font("Microsoft YaHei UI", fontSize, FontStyle.Regular, GraphicsUnit.Point);
            label.Padding = new Padding(18, 16, 18, 16);
            label.TextAlign = ContentAlignment.TopLeft;
            Bounds = new Rectangle(x, y, width, height);
            label.Bounds = new Rectangle(0, 0, width, height);
            label.Text = text;
            if (!Visible) Show();
            NativeMethods.SetWindowPos(
                Handle,
                NativeMethods.HwndTopMost,
                x,
                y,
                width,
                height,
                NativeMethods.SwpNoActivate | NativeMethods.SwpShowWindow);
        }

        internal void HideTranslation()
        {
            if (Visible) Hide();
        }
    }

    internal sealed class OverlayManager
    {
        private readonly OverlayForm primary;
        private readonly Dictionary<string, OverlayForm> forms = new Dictionary<string, OverlayForm>();

        internal OverlayManager(OverlayForm primaryForm) { primary = primaryForm; }

        internal void Show(string key, string text, Rectangle target, string layout)
        {
            OverlayForm current;
            if (key == "hover") current = primary;
            else if (!forms.TryGetValue(key, out current))
            {
                current = new OverlayForm();
                forms[key] = current;
            }
            current.ShowTranslation(text, target, layout);
        }

        internal void Hide(string key)
        {
            if (key == "hover") primary.HideTranslation();
            else
            {
                OverlayForm current;
                if (forms.TryGetValue(key, out current)) current.HideTranslation();
            }
        }

        internal void Reset()
        {
            primary.HideTranslation();
            foreach (OverlayForm current in forms.Values)
            {
                try { current.Close(); current.Dispose(); } catch { }
            }
            forms.Clear();
        }

        internal void CloseAll()
        {
            Reset();
            primary.Close();
        }
    }

    internal static class NativeMethods
    {
        internal static readonly IntPtr HwndTopMost = new IntPtr(-1);
        internal static readonly IntPtr DpiAwarenessContextPerMonitorAwareV2 = new IntPtr(-4);
        internal const uint SwpNoActivate = 0x0010;
        internal const uint SwpShowWindow = 0x0040;

        [StructLayout(LayoutKind.Sequential)]
        internal struct Point { internal int X; internal int Y; }

        [DllImport("user32.dll", EntryPoint = "GetWindowLongPtrW")]
        internal static extern IntPtr GetWindowLongPtr(IntPtr window, int index);

        [DllImport("user32.dll")]
        internal static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        internal static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);

        [DllImport("user32.dll")]
        internal static extern bool GetCursorPos(out Point point);

        [DllImport("user32.dll")]
        internal static extern IntPtr WindowFromPoint(Point point);

        [DllImport("user32.dll")]
        internal static extern IntPtr GetAncestor(IntPtr window, uint flags);

        [DllImport("user32.dll")]
        internal static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        internal static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);

        [DllImport("user32.dll")]
        internal static extern bool SetProcessDPIAware();

        [DllImport("user32.dll")]
        internal static extern bool SetProcessDpiAwarenessContext(IntPtr value);
    }

    public static class OverlayProgram
    {
        private sealed class Candidate
        {
            internal string Text;
            internal Rectangle Bounds;
            internal string Kind = "normal";
            internal string Context = String.Empty;
        }

        private sealed class TextFragment
        {
            internal string Text;
            internal Rectangle Bounds;
            internal bool Offscreen;
        }

        private static OverlayForm form;
        private static OverlayManager manager;
        private static volatile string mode = "off";
        private static string lastText = String.Empty;
        private static string lastPreloadFingerprint = String.Empty;
        private static int preloadRevision;
        private static int preloadTick;
        private static int hoverSkillTick;
        private static Candidate hoverSkillCandidate;
        private static System.Windows.Forms.Timer captureTimer;
        private static readonly string[] KnownCardTitles = new string[]
        {
            "HyperFrames by HeyGen", "Business & Operations", "Manage Google Calendar", "Outlook Calendar",
            "OpenAI Developers", "Google Calendar", "Google Drive", "Outlook Email", "Atlassian Rovo",
            "Data Analytics", "Default templates", "Build Web Apps", "Computer Use", "Template Creator",
            "Product Design", "Monday.com", "Presentations", "Spreadsheets", "SharePoint", "Superpowers",
            "AllTrails", "Airtable", "Documents", "Chrome", "ClickUp", "GitHub", "Gmail", "Notion",
            "Linear", "Canva", "Adobe", "Gamma", "Figma", "Slack", "Teams", "HubSpot", "Asana",
            "Vercel", "Granola", "Supabase", "Box", "Zoom"
        };

        public static void Probe()
        {
            EnableDpiAwareness();
            using (OverlayForm probe = new OverlayForm())
            {
                probe.Location = new Point(-30000, -30000);
                probe.Size = new Size(120, 60);
                probe.Opacity = 0.01;
                probe.Show();
                Application.DoEvents();
                long style = NativeMethods.GetWindowLongPtr(probe.Handle, -20).ToInt64();
                long hit = NativeMethods.SendMessage(probe.Handle, OverlayForm.WmNcHitTest, IntPtr.Zero, IntPtr.Zero).ToInt64();
                Console.Out.WriteLine(
                    "{\"handleCreated\":true," +
                    "\"transparent\":" + Bool((style & OverlayForm.WsExTransparent) != 0) + "," +
                    "\"layered\":" + Bool((style & OverlayForm.WsExLayered) != 0) + "," +
                    "\"noActivate\":" + Bool((style & OverlayForm.WsExNoActivate) != 0) + "," +
                    "\"toolWindow\":" + Bool((style & OverlayForm.WsExToolWindow) != 0) + "," +
                    "\"hitTest\":" + hit.ToString() + "}");
            }
        }

        public static void PanelProbe()
        {
            EnableDpiAwareness();
            Rectangle working = Screen.PrimaryScreen.WorkingArea;
            int sourceWidth = Math.Min(620, Math.Max(420, working.Width / 3));
            int sourceHeight = Math.Min(650, Math.Max(360, working.Height - 180));
            Rectangle source = new Rectangle(
                working.Left + 32,
                working.Top + 72,
                sourceWidth,
                sourceHeight);
            using (OverlayForm probe = new OverlayForm())
            {
                probe.ShowTranslation(
                    "完整中文翻译\n\n第一段中文翻译。\n\n第二段中文翻译。\n\n• guidance：指南。",
                    source,
                    "panel");
                Application.DoEvents();
                long style = NativeMethods.GetWindowLongPtr(probe.Handle, -20).ToInt64();
                long hit = NativeMethods.SendMessage(probe.Handle, OverlayForm.WmNcHitTest, IntPtr.Zero, IntPtr.Zero).ToInt64();
                Rectangle panel = probe.Bounds;
                Console.Out.WriteLine(
                    "{\"transparent\":" + Bool((style & OverlayForm.WsExTransparent) != 0) + "," +
                    "\"noActivate\":" + Bool((style & OverlayForm.WsExNoActivate) != 0) + "," +
                    "\"hitTest\":" + hit.ToString() + "," +
                    "\"layout\":\"panel\"," +
                    "\"overlapsSource\":" + Bool(panel.IntersectsWith(source)) + "," +
                    "\"width\":" + panel.Width.ToString() + "," +
                    "\"height\":" + panel.Height.ToString() + "}");
            }
        }

        public static void SkillAggregationProbe()
        {
            List<TextFragment> fragments = new List<TextFragment>();
            fragments.Add(new TextFragment { Text = "Computer Use Skill", Bounds = new Rectangle(180, 120, 240, 32) });
            fragments.Add(new TextFragment { Text = "Use this skill to automate the UI of Microsoft Windows apps.", Bounds = new Rectangle(180, 190, 560, 52) });
            fragments.Add(new TextFragment { Text = "If this plugin is available, read this entire SKILL.md once before Windows automation work.", Bounds = new Rectangle(180, 254, 560, 66) });
            fragments.Add(new TextFragment { Text = "Start with the directions below.", Bounds = new Rectangle(180, 332, 560, 32) });
            fragments.Add(new TextFragment { Text = "guidance: core runtime behavior and recovery guidance.", Bounds = new Rectangle(198, 376, 542, 42) });
            fragments.Add(new TextFragment { Text = "api: full API reference.", Bounds = new Rectangle(198, 430, 542, 30) });
            fragments.Add(new TextFragment { Text = "Initialize", Bounds = new Rectangle(180, 476, 180, 30) });
            fragments.Add(new TextFragment { Text = "The bundled package is the core entry point.", Bounds = new Rectangle(180, 518, 560, 42), Offscreen = true });
            fragments.Add(new TextFragment { Text = "功能", Bounds = new Rectangle(180, 580, 90, 28), Offscreen = true });
            fragments.Add(new TextFragment { Text = "Interactive, Read, Write", Bounds = new Rectangle(300, 580, 260, 28), Offscreen = true });
            Candidate candidate = BuildSkillCandidate(fragments, new Rectangle(0, 0, 1000, 800));
            string text = candidate == null ? String.Empty : candidate.Text;
            Console.Out.WriteLine(
                "{\"found\":" + Bool(candidate != null) +
                ",\"text\":\"" + JsonEscape(text) + "\"" +
                ",\"containsTrailingMetadata\":" + Bool(text.IndexOf("Interactive, Read, Write", StringComparison.Ordinal) >= 0) + "}");
        }

        public static void GenericSkillAggregationProbe()
        {
            List<TextFragment> chrome = new List<TextFragment>();
            chrome.Add(new TextFragment { Text = "Control Chrome Skill", Bounds = new Rectangle(180, 120, 300, 32) });
            chrome.Add(new TextFragment { Text = "Control the user's Chrome browser for tasks that depend on existing Chrome state.", Bounds = new Rectangle(180, 172, 560, 54) });
            chrome.Add(new TextFragment { Text = "Stop: choose the right surface before any browser action", Bounds = new Rectangle(180, 238, 560, 34) });
            chrome.Add(new TextFragment { Text = "Explicit browser intent wins when the user names Chrome or asks to open, show, or navigate to a page.", Bounds = new Rectangle(180, 284, 560, 66) });
            chrome.Add(new TextFragment { Text = "Use this skill for browser automation tasks such as inspecting pages, navigating, testing local apps, clicking, typing, and taking screenshots.", Bounds = new Rectangle(180, 362, 560, 76) });
            Candidate chromeCandidate = BuildSkillCandidate(chrome, new Rectangle(0, 0, 1000, 800));

            List<TextFragment> documents = new List<TextFragment>();
            documents.Add(new TextFragment { Text = "Documents Skill", Bounds = new Rectangle(180, 120, 240, 32) });
            documents.Add(new TextFragment { Text = "Create and edit document artifacts while preserving the requested structure and formatting.", Bounds = new Rectangle(180, 172, 560, 54) });
            documents.Add(new TextFragment { Text = "Read the complete source before making changes to an existing document.", Bounds = new Rectangle(180, 238, 560, 44) });
            documents.Add(new TextFragment { Text = "Keep headings, paragraphs, lists, tables, and references synchronized with the original content.", Bounds = new Rectangle(180, 294, 560, 54) });
            documents.Add(new TextFragment { Text = "Verify the final document after editing and report any unsupported layout behavior.", Bounds = new Rectangle(180, 360, 560, 54) });
            Candidate documentCandidate = BuildSkillCandidate(documents, new Rectangle(0, 0, 1000, 800));

            List<TextFragment> combined = new List<TextFragment>();
            combined.Add(new TextFragment {
                Text = "Control Chrome Skill Control the user's Chrome browser for tasks that depend on existing Chrome state. Stop: choose the right surface before any browser action. Explicit browser intent wins when the user names Chrome. Use this skill for browser automation tasks including inspecting pages, navigating, clicking, typing, and taking screenshots.",
                Bounds = new Rectangle(180, 120, 560, 430)
            });
            Candidate combinedNodeCandidate = BuildSkillCandidate(combined, new Rectangle(0, 0, 1000, 800));

            Console.Out.WriteLine(
                "{\"chromeFound\":" + Bool(chromeCandidate != null) +
                ",\"chromeText\":\"" + JsonEscape(chromeCandidate == null ? String.Empty : chromeCandidate.Text) + "\"" +
                ",\"documentFound\":" + Bool(documentCandidate != null) +
                ",\"documentText\":\"" + JsonEscape(documentCandidate == null ? String.Empty : documentCandidate.Text) + "\"" +
                ",\"combinedNodeFound\":" + Bool(combinedNodeCandidate != null) +
                ",\"combinedNodeText\":\"" + JsonEscape(combinedNodeCandidate == null ? String.Empty : combinedNodeCandidate.Text) + "\"}");
        }

        public static void CardHoverProbe()
        {
            List<Candidate> candidates = new List<Candidate>();
            HashSet<string> seen = new HashSet<string>();
            bool found = TryAddCardCandidates(
                null,
                "Computer Use Computer Use Control Windows apps from ChatGPT",
                new Rectangle(100, 100, 440, 76),
                candidates,
                seen);
            Candidate title = candidates.Find(delegate(Candidate value) { return value.Kind == "title"; });
            Candidate description = candidates.Find(delegate(Candidate value) { return value.Kind == "normal"; });
            Console.Out.WriteLine(
                "{\"found\":" + Bool(found && title != null && description != null) +
                ",\"title\":\"" + JsonEscape(title == null ? String.Empty : title.Text) + "\"" +
                ",\"description\":\"" + JsonEscape(description == null ? String.Empty : description.Text) + "\"" +
                ",\"titleY\":" + (title == null ? 0 : title.Bounds.Y) +
                ",\"descriptionY\":" + (description == null ? 0 : description.Bounds.Y) +
                ",\"titleWidth\":" + (title == null ? 0 : title.Bounds.Width) +
                ",\"descriptionWidth\":" + (description == null ? 0 : description.Bounds.Width) + "}");
        }

        public static void Run()
        {
            EnableDpiAwareness();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            form = new OverlayForm();
            manager = new OverlayManager(form);
            captureTimer = new System.Windows.Forms.Timer();
            captureTimer.Interval = 250;
            captureTimer.Tick += delegate
            {
                if (mode == "hover") CaptureHover();
                else if (mode == "preload" && (++preloadTick % 6 == 1)) CapturePreload();
            };
            captureTimer.Start();

            Thread reader = new Thread(ReadCommands);
            reader.IsBackground = true;
            reader.Name = "BilingualOverlayCommands";
            reader.Start();
            Application.Run(form);
        }

        private static void ReadCommands()
        {
            string line;
            while ((line = Console.In.ReadLine()) != null)
            {
                string[] parts = line.Split('|');
                string command = parts.Length > 0 ? parts[0] : String.Empty;
                if (command == "MODE" && parts.Length >= 2)
                {
                    mode = parts[1];
                    lastText = String.Empty;
                    lastPreloadFingerprint = String.Empty;
                    preloadTick = 0;
                    hoverSkillTick = 0;
                    hoverSkillCandidate = null;
                    Invoke(delegate { manager.Reset(); });
                }
                else if (command == "SHOW" && parts.Length >= 8)
                {
                    string key = parts[1];
                    string text = Encoding.UTF8.GetString(Convert.FromBase64String(parts[2]));
                    Rectangle target = new Rectangle(Parse(parts[3]), Parse(parts[4]), Parse(parts[5]), Parse(parts[6]));
                    string layout = parts[7];
                    Invoke(delegate { manager.Show(key, text, target, layout); });
                }
                else if (command == "HIDE")
                {
                    string key = parts.Length >= 2 ? parts[1] : "hover";
                    Invoke(delegate { manager.Hide(key); });
                }
                else if (command == "RESET") Invoke(delegate { manager.Reset(); });
                else if (command == "EXIT")
                {
                    Invoke(delegate { manager.CloseAll(); });
                    return;
                }
            }
            Invoke(delegate { manager.CloseAll(); });
        }

        private static void CaptureHover()
        {
            try
            {
                NativeMethods.Point point;
                if (!NativeMethods.GetCursorPos(out point) || !IsCodexPoint(point))
                {
                    ClearHover();
                    return;
                }
                AutomationElement element = AutomationElement.FromPoint(new System.Windows.Point(point.X, point.Y));
                if (++hoverSkillTick % 6 == 1)
                {
                    IntPtr window = NativeMethods.GetAncestor(NativeMethods.WindowFromPoint(point), 2);
                    hoverSkillCandidate = FindFullSkillCandidate(window);
                }
                if (hoverSkillCandidate != null && hoverSkillCandidate.Bounds.Contains(point.X, point.Y))
                {
                    string fullIdentity = "skill-full:" + hoverSkillCandidate.Text;
                    if (fullIdentity == lastText) return;
                    lastText = fullIdentity;
                    WriteCapture("HOVER_FULL", hoverSkillCandidate.Text, new System.Windows.Rect(
                        hoverSkillCandidate.Bounds.X, hoverSkillCandidate.Bounds.Y,
                        hoverSkillCandidate.Bounds.Width, hoverSkillCandidate.Bounds.Height));
                    return;
                }
                Candidate cardTitle;
                Candidate cardDescription;
                if (TryGetHoverCard(element, out cardTitle, out cardDescription))
                {
                    string cardIdentity = "card:" + cardTitle.Text + "|" + cardDescription.Text;
                    if (cardIdentity == lastText) return;
                    lastText = cardIdentity;
                    WriteHoverCard(cardTitle, cardDescription);
                    return;
                }
                AutomationElement candidate = BestCandidate(element, point.X, point.Y);
                if (candidate == null) { ClearHover(); return; }
                string text = candidate.Current.Name == null ? String.Empty : candidate.Current.Name.Trim();
                System.Windows.Rect bounds = candidate.Current.BoundingRectangle;
                if (text.Length < 2 || bounds.IsEmpty || text == lastText) return;
                lastText = text;
                WriteCapture("HOVER", text, bounds);
            }
            catch { ClearHover(); }
        }

        private static bool TryGetHoverCard(
            AutomationElement element,
            out Candidate title,
            out Candidate description)
        {
            title = null;
            description = null;
            AutomationElement current = element;
            for (int depth = 0; depth < 8 && current != null; depth++)
            {
                try
                {
                    ControlType type = current.Current.ControlType;
                    System.Windows.Rect rect = current.Current.BoundingRectangle;
                    string accessibleName = current.Current.Name == null ? String.Empty : current.Current.Name.Trim();
                    if ((type == ControlType.Button || type == ControlType.ListItem) && !rect.IsEmpty &&
                        rect.Width >= 320 && rect.Height >= 60 && accessibleName.Length > 0)
                    {
                        Rectangle card = new Rectangle(
                            (int)Math.Round(rect.X), (int)Math.Round(rect.Y),
                            (int)Math.Round(rect.Width), (int)Math.Round(rect.Height));
                        List<Candidate> candidates = new List<Candidate>();
                        HashSet<string> seen = new HashSet<string>();
                        if (TryAddCardCandidates(current, accessibleName, card, candidates, seen))
                        {
                            title = candidates.Find(delegate(Candidate value) { return value.Kind == "title"; });
                            description = candidates.Find(delegate(Candidate value) { return value.Kind == "normal"; });
                            if (title != null && description != null) return true;
                        }
                    }
                    current = TreeWalker.RawViewWalker.GetParent(current);
                }
                catch { break; }
            }
            title = null;
            description = null;
            return false;
        }

        private static Candidate FindFullSkillCandidate(IntPtr window)
        {
            if (!IsCodexWindow(window)) return null;
            try
            {
                AutomationElement root = AutomationElement.FromHandle(window);
                System.Windows.Rect rootRect = root.Current.BoundingRectangle;
                AutomationElementCollection elements = root.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                List<TextFragment> fragments = new List<TextFragment>();
                int inspected = Math.Min(elements.Count, 2000);
                for (int i = 0; i < inspected; i++)
                {
                    try
                    {
                        AutomationElement item = elements[i];
                        string text = item.Current.Name == null ? String.Empty : item.Current.Name.Trim();
                        if (text.Length < 2 || text.Length > 12000) continue;
                        ControlType type = item.Current.ControlType;
                        if (type != ControlType.Text && type != ControlType.Button && type != ControlType.ListItem &&
                            type != ControlType.MenuItem && type != ControlType.Hyperlink) continue;
                        System.Windows.Rect rect = item.Current.BoundingRectangle;
                        Rectangle bounds = rect.IsEmpty ? Rectangle.Empty : new Rectangle(
                            (int)Math.Round(rect.X), (int)Math.Round(rect.Y),
                            (int)Math.Round(rect.Width), (int)Math.Round(rect.Height));
                        fragments.Add(new TextFragment { Text = text, Bounds = bounds, Offscreen = item.Current.IsOffscreen });
                    }
                    catch { }
                }
                return BuildSkillCandidate(fragments, new Rectangle(
                    (int)Math.Round(rootRect.X), (int)Math.Round(rootRect.Y),
                    (int)Math.Round(rootRect.Width), (int)Math.Round(rootRect.Height)));
            }
            catch { return null; }
        }

        private static void CapturePreload()
        {
            try
            {
                IntPtr window = NativeMethods.GetForegroundWindow();
                if (!IsCodexWindow(window))
                {
                    ClearPreload();
                    return;
                }
                AutomationElement root = AutomationElement.FromHandle(window);
                System.Windows.Rect rootBounds = root.Current.BoundingRectangle;
                AutomationElementCollection elements = root.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                List<Candidate> candidates = new List<Candidate>();
                List<TextFragment> fragments = new List<TextFragment>();
                HashSet<string> seen = new HashSet<string>();
                Candidate fullCandidate = null;
                int inspected = Math.Min(elements.Count, 1600);
                for (int i = 0; i < inspected && candidates.Count < 120; i++)
                {
                    try
                    {
                        AutomationElement element = elements[i];
                        string text = element.Current.Name == null ? String.Empty : element.Current.Name.Trim();
                        if (text.Length < 2 || text.Length > 12000) continue;
                        ControlType type = element.Current.ControlType;
                        if (type != ControlType.Text && type != ControlType.Button && type != ControlType.ListItem &&
                            type != ControlType.MenuItem && type != ControlType.TabItem && type != ControlType.CheckBox &&
                            type != ControlType.Hyperlink) continue;
                        System.Windows.Rect rect = element.Current.BoundingRectangle;
                        Rectangle rawBounds = rect.IsEmpty ? Rectangle.Empty : new Rectangle(
                            (int)Math.Round(rect.X), (int)Math.Round(rect.Y),
                            (int)Math.Round(rect.Width), (int)Math.Round(rect.Height));
                        fragments.Add(new TextFragment { Text = text, Bounds = rawBounds, Offscreen = element.Current.IsOffscreen });
                        if (!Regex.IsMatch(text, "[A-Za-z]{2}") || element.Current.IsOffscreen) continue;
                        if (rect.IsEmpty || rect.Width < 8 || rect.Height < 8 || rect.Width > 1500 || rect.Height > 950) continue;
                        if (!Intersects(rect, rootBounds)) continue;
                        Rectangle bounds = new Rectangle(
                            (int)Math.Round(rect.X), (int)Math.Round(rect.Y),
                            (int)Math.Round(rect.Width), (int)Math.Round(rect.Height));
                        Rectangle working = Screen.FromRectangle(bounds).WorkingArea;
                        if (bounds.Top < working.Top || bounds.Bottom > working.Bottom) continue;
                        if (IsFullSkillCandidate(text, bounds, rootBounds))
                        {
                            if (fullCandidate == null || text.Length > fullCandidate.Text.Length)
                                fullCandidate = new Candidate { Text = text, Bounds = bounds, Kind = "full" };
                            continue;
                        }
                        if (type == ControlType.Button && bounds.Width <= 90 && bounds.Height <= 90) continue;
                        if (type == ControlType.Button && TryAddCardCandidates(element, text, bounds, candidates, seen)) continue;
                        if ((type == ControlType.Button || type == ControlType.ListItem) && HasEnglishDescendant(element)) continue;
                        string kind = IsKnownTitleText(text) ? "title" : "normal";
                        if (kind == "title") bounds = TightTitleBounds(text, bounds);
                        AddCandidate(candidates, seen, text, bounds, kind, String.Empty);
                    }
                    catch { }
                }
                Candidate aggregatedSkill = BuildSkillCandidate(fragments, new Rectangle(
                    (int)Math.Round(rootBounds.X), (int)Math.Round(rootBounds.Y),
                    (int)Math.Round(rootBounds.Width), (int)Math.Round(rootBounds.Height)));
                if (aggregatedSkill != null) fullCandidate = aggregatedSkill;
                if (fullCandidate != null)
                    candidates.RemoveAll(delegate(Candidate candidate) {
                        return candidate.Kind == "normal" && candidate.Bounds.IntersectsWith(fullCandidate.Bounds);
                    });
                if (fullCandidate != null)
                    AddCandidate(candidates, seen, fullCandidate.Text, fullCandidate.Bounds, "full", String.Empty);
                candidates.Sort(delegate(Candidate a, Candidate b)
                {
                    int byY = a.Bounds.Y.CompareTo(b.Bounds.Y);
                    return byY != 0 ? byY : a.Bounds.X.CompareTo(b.Bounds.X);
                });

                StringBuilder fingerprint = new StringBuilder();
                foreach (Candidate candidate in candidates)
                    fingerprint.Append(candidate.Kind).Append(':').Append(candidate.Text).Append('@')
                        .Append(candidate.Bounds.ToString()).Append('\n');
                string currentFingerprint = fingerprint.ToString();
                if (currentFingerprint == lastPreloadFingerprint) return;
                lastPreloadFingerprint = currentFingerprint;
                string revision = (++preloadRevision).ToString();
                StringBuilder output = new StringBuilder();
                output.Append("PRELOAD_RESET|").Append(revision).Append('\n');
                for (int i = 0; i < candidates.Count; i++)
                {
                    Candidate candidate = candidates[i];
                    string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(candidate.Text));
                    string context = Convert.ToBase64String(Encoding.UTF8.GetBytes(candidate.Context));
                    output.Append("PRELOAD|").Append(revision).Append('|').Append(i.ToString()).Append('|')
                        .Append(candidate.Kind).Append('|').Append(encoded).Append('|').Append(context).Append('|')
                        .Append(candidate.Bounds.X).Append('|').Append(candidate.Bounds.Y)
                        .Append('|').Append(candidate.Bounds.Width).Append('|').Append(candidate.Bounds.Height).Append('\n');
                }
                Console.Out.Write(output.ToString());
                Console.Out.Flush();
            }
            catch { ClearPreload(); }
        }

        private static AutomationElement BestCandidate(AutomationElement element, int x, int y)
        {
            AutomationElement best = null;
            AutomationElement current = element;
            for (int depth = 0; depth < 4 && current != null; depth++)
            {
                try
                {
                    string name = current.Current.Name;
                    System.Windows.Rect rect = current.Current.BoundingRectangle;
                    if (!String.IsNullOrWhiteSpace(name) && !rect.IsEmpty && rect.Contains(x, y) &&
                        rect.Width <= 1200 && rect.Height <= 500 && name.Length <= 1200)
                    {
                        if (best == null || (name.Length > best.Current.Name.Length && rect.Height <= 220)) best = current;
                    }
                    current = TreeWalker.RawViewWalker.GetParent(current);
                }
                catch { break; }
            }
            try
            {
                AutomationElementCollection descendants = element.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                double bestArea = best == null ? Double.MaxValue :
                    best.Current.BoundingRectangle.Width * best.Current.BoundingRectangle.Height;
                int inspected = Math.Min(descendants.Count, 800);
                for (int i = 0; i < inspected; i++)
                {
                    AutomationElement candidate = descendants[i];
                    string name = candidate.Current.Name;
                    System.Windows.Rect rect = candidate.Current.BoundingRectangle;
                    if (String.IsNullOrWhiteSpace(name) || rect.IsEmpty || !rect.Contains(x, y) ||
                        rect.Width > 1200 || rect.Height > 500 || name.Length > 1200) continue;
                    double area = rect.Width * rect.Height;
                    if (area < bestArea)
                    {
                        best = candidate;
                        bestArea = area;
                    }
                }
            }
            catch { }
            return best;
        }

        private static bool HasEnglishDescendant(AutomationElement element)
        {
            try
            {
                AutomationElementCollection descendants = element.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                int inspected = Math.Min(descendants.Count, 60);
                for (int i = 0; i < inspected; i++)
                {
                    AutomationElement child = descendants[i];
                    string name = child.Current.Name;
                    System.Windows.Rect bounds = child.Current.BoundingRectangle;
                    ControlType type = child.Current.ControlType;
                    if (!String.IsNullOrWhiteSpace(name) && Regex.IsMatch(name, "[A-Za-z]{2}") &&
                        type != ControlType.Image && !bounds.IsEmpty && !child.Current.IsOffscreen) return true;
                }
            }
            catch { }
            return false;
        }

        private static bool TryAddCardCandidates(
            AutomationElement element,
            string accessibleName,
            Rectangle card,
            List<Candidate> candidates,
            HashSet<string> seen)
        {
            if (card.Width < 320 || card.Height < 70) return false;
            string title = String.Empty;
            try
            {
                AutomationElementCollection descendants = element.FindAll(TreeScope.Descendants, Condition.TrueCondition);
                int inspected = Math.Min(descendants.Count, 40);
                for (int i = 0; i < inspected; i++)
                {
                    AutomationElement child = descendants[i];
                    if (child.Current.ControlType != ControlType.Image) continue;
                    string name = child.Current.Name == null ? String.Empty : child.Current.Name.Trim();
                    if (!String.IsNullOrWhiteSpace(name)) { title = name; break; }
                }
            }
            catch { }
            if (title.Length == 0) title = FindKnownCardTitle(accessibleName);
            if (title.Length == 0 || !accessibleName.StartsWith(title, StringComparison.OrdinalIgnoreCase)) return false;

            string description = accessibleName.Substring(title.Length).Trim();
            if (description.StartsWith(title, StringComparison.OrdinalIgnoreCase))
                description = description.Substring(title.Length).Trim();
            string[] actions = new string[] { "更多操作", "安装", "禁用技能", "启用技能" };
            foreach (string action in actions)
                if (description.EndsWith(action, StringComparison.Ordinal))
                    description = description.Substring(0, description.Length - action.Length).Trim();

            int titleWidth = Math.Min(card.Width - 105, Math.Max(80, title.Length * 14));
            AddCandidate(
                candidates,
                seen,
                title,
                new Rectangle(card.X + 84, card.Y + 8, titleWidth, 28),
                "title",
                description);
            if (description.Length > 0)
            {
                int descriptionWidth = Math.Min(card.Width - 105, Math.Max(160, description.Length * 10));
                AddCandidate(
                    candidates,
                    seen,
                    description,
                    new Rectangle(card.X + 84, card.Y + 40, descriptionWidth, 26),
                    "normal",
                    String.Empty);
            }
            return true;
        }

        private static string FindKnownCardTitle(string accessibleName)
        {
            foreach (string title in KnownCardTitles)
            {
                if (String.Equals(accessibleName, title, StringComparison.OrdinalIgnoreCase) ||
                    accessibleName.StartsWith(title + " ", StringComparison.OrdinalIgnoreCase)) return title;
            }
            return String.Empty;
        }

        private static bool IsKnownTitleText(string text)
        {
            foreach (string title in KnownCardTitles)
                if (String.Equals(text, title, StringComparison.OrdinalIgnoreCase)) return true;
            if (text.EndsWith(" Skill", StringComparison.OrdinalIgnoreCase))
            {
                string baseTitle = text.Substring(0, text.Length - 6).Trim();
                foreach (string title in KnownCardTitles)
                    if (String.Equals(baseTitle, title, StringComparison.OrdinalIgnoreCase)) return true;
            }
            return false;
        }

        private static bool IsFullSkillCandidate(string text, Rectangle bounds, System.Windows.Rect rootBounds)
        {
            if (text.Length < 120 || bounds.Width < 420 || bounds.Width > 900 || bounds.Height < 120) return false;
            if (bounds.Width >= rootBounds.Width * 0.72 || bounds.Height >= rootBounds.Height * 0.92) return false;
            if (Regex.IsMatch(text, "[\u4E00-\u9FFF]")) return false;
            string prefix = text.Substring(0, Math.Min(180, text.Length));
            bool genericSkill = Regex.IsMatch(prefix, "\\bSkill\\b", RegexOptions.IgnoreCase);
            bool legacySkill = text.IndexOf("Use this skill", StringComparison.OrdinalIgnoreCase) >= 0 &&
                text.IndexOf("SKILL.md", StringComparison.OrdinalIgnoreCase) >= 0;
            return genericSkill || legacySkill;
        }

        private static Candidate BuildSkillCandidate(List<TextFragment> fragments, Rectangle rootBounds)
        {
            int title = -1;
            for (int i = 0; i < fragments.Count; i++)
            {
                string titleText = fragments[i].Text == null ? String.Empty : fragments[i].Text.Trim();
                Rectangle titleBounds = fragments[i].Bounds;
                if (Regex.IsMatch(titleText, "^[A-Za-z][A-Za-z0-9 .:/+&'()-]{1,80} Skill\\b", RegexOptions.IgnoreCase) &&
                    !fragments[i].Offscreen && !titleBounds.IsEmpty && titleBounds.Width <= 900 &&
                    (titleBounds.Height <= 90 || titleText.Length >= 160))
                {
                    title = i;
                    break;
                }
            }
            int start = -1;
            if (title >= 0) start = 0;
            for (int i = 0; start < 0 && i < fragments.Count; i++)
            {
                if (fragments[i].Text.IndexOf("Use this skill", StringComparison.OrdinalIgnoreCase) >= 0)
                {
                    start = i;
                    break;
                }
            }
            if (start < 0) return null;

            int limit = Math.Min(fragments.Count, start + 140);
            bool hasSkillMd = false;
            bool hasInitialize = false;
            for (int i = start; i < limit; i++)
            {
                string value = fragments[i].Text;
                hasSkillMd |= value.IndexOf("SKILL.md", StringComparison.OrdinalIgnoreCase) >= 0;
                hasInitialize |= value.IndexOf("Initialize", StringComparison.OrdinalIgnoreCase) >= 0;
            }
            if (title < 0 && (!hasSkillMd || !hasInitialize)) return null;

            string[] metadataMarkers = new string[] { "功能", "开发者", "类别", "版本", "网站" };
            List<string> paragraphs = new List<string>();
            HashSet<string> seen = new HashSet<string>();
            Rectangle visibleBounds = Rectangle.Empty;
            for (int i = start; i < limit; i++)
            {
                string value = fragments[i].Text.Trim();
                if (paragraphs.Count >= 3 && Array.Exists(metadataMarkers, marker => value == marker)) break;
                if (!Regex.IsMatch(value, "[A-Za-z]{2}") || !seen.Add(value)) continue;
                if (Regex.IsMatch(value, "[\u4E00-\u9FFF]") || value.EndsWith(" Skill", StringComparison.OrdinalIgnoreCase)) continue;
                if (value == "立即试用" || value == "Computer Use Skill") continue;
                paragraphs.Add(value);
                Rectangle bounds = fragments[i].Bounds;
                if (!fragments[i].Offscreen && !bounds.IsEmpty && bounds.IntersectsWith(rootBounds))
                    visibleBounds = visibleBounds.IsEmpty ? bounds : Rectangle.Union(visibleBounds, bounds);
            }
            if (paragraphs.Count < 4 && !(title >= 0 && paragraphs.Count >= 1)) return null;
            string combined = String.Join("\n\n", paragraphs.ToArray());
            if (combined.Length < 160) return null;
            if (title < 0 && (combined.IndexOf("SKILL.md", StringComparison.OrdinalIgnoreCase) < 0 ||
                combined.IndexOf("Initialize", StringComparison.OrdinalIgnoreCase) < 0)) return null;
            if (visibleBounds.IsEmpty) visibleBounds = rootBounds;
            return new Candidate { Text = combined, Bounds = visibleBounds, Kind = "full" };
        }

        private static Rectangle TightTitleBounds(string text, Rectangle bounds)
        {
            int desired = Math.Max(90, Math.Min(360, text.Length * 16 + 18));
            return new Rectangle(bounds.X, bounds.Y, Math.Min(bounds.Width, desired), bounds.Height);
        }

        private static void AddCandidate(
            List<Candidate> candidates,
            HashSet<string> seen,
            string text,
            Rectangle bounds,
            string kind,
            string context)
        {
            if (String.IsNullOrWhiteSpace(text) || !Regex.IsMatch(text, "[A-Za-z]{2}")) return;
            string identity = kind + "|" + text + "|" + bounds.X + "|" + bounds.Y + "|" + bounds.Width + "|" + bounds.Height;
            if (seen.Add(identity)) candidates.Add(new Candidate {
                Text = text,
                Bounds = bounds,
                Kind = kind,
                Context = context == null ? String.Empty : context,
            });
        }

        private static bool IsCodexPoint(NativeMethods.Point point)
        {
            IntPtr window = NativeMethods.GetAncestor(NativeMethods.WindowFromPoint(point), 2);
            return IsCodexWindow(window);
        }

        private static bool IsCodexWindow(IntPtr window)
        {
            uint processId;
            NativeMethods.GetWindowThreadProcessId(window, out processId);
            if (processId == 0) return false;
            try { return String.Equals(Process.GetProcessById((int)processId).ProcessName, "ChatGPT", StringComparison.OrdinalIgnoreCase); }
            catch { return false; }
        }

        private static void ClearHover()
        {
            if (lastText.Length == 0) return;
            lastText = String.Empty;
            Console.Out.WriteLine("CLEAR");
            Console.Out.Flush();
        }

        private static void ClearPreload()
        {
            if (lastPreloadFingerprint.Length == 0) return;
            lastPreloadFingerprint = String.Empty;
            string revision = (++preloadRevision).ToString();
            Console.Out.WriteLine("PRELOAD_RESET|" + revision);
            Console.Out.Flush();
        }

        private static void WriteCapture(string eventName, string text, System.Windows.Rect bounds)
        {
            string encoded = Convert.ToBase64String(Encoding.UTF8.GetBytes(text));
            Console.Out.WriteLine(
                eventName + "|" + encoded + "|" +
                ((int)Math.Round(bounds.X)).ToString() + "|" +
                ((int)Math.Round(bounds.Y)).ToString() + "|" +
                ((int)Math.Round(bounds.Width)).ToString() + "|" +
                ((int)Math.Round(bounds.Height)).ToString());
            Console.Out.Flush();
        }

        private static void WriteHoverCard(Candidate title, Candidate description)
        {
            Console.Out.WriteLine(
                "HOVER_CARD|" + Convert.ToBase64String(Encoding.UTF8.GetBytes(title.Text)) + "|" +
                Convert.ToBase64String(Encoding.UTF8.GetBytes(description.Text)) + "|" +
                title.Bounds.X + "|" + title.Bounds.Y + "|" + title.Bounds.Width + "|" + title.Bounds.Height + "|" +
                description.Bounds.X + "|" + description.Bounds.Y + "|" + description.Bounds.Width + "|" + description.Bounds.Height);
            Console.Out.Flush();
        }

        private static void Invoke(MethodInvoker action)
        {
            try
            {
                if (form == null || form.IsDisposed) return;
                if (form.InvokeRequired) form.BeginInvoke(action); else action();
            }
            catch { }
        }

        private static void EnableDpiAwareness()
        {
            try { if (NativeMethods.SetProcessDpiAwarenessContext(NativeMethods.DpiAwarenessContextPerMonitorAwareV2)) return; }
            catch { }
            try { NativeMethods.SetProcessDPIAware(); } catch { }
        }

        private static bool Intersects(System.Windows.Rect a, System.Windows.Rect b)
        {
            return a.Left < b.Right && a.Right > b.Left && a.Top < b.Bottom && a.Bottom > b.Top;
        }

        private static int Parse(string value)
        {
            int parsed;
            return Int32.TryParse(value, out parsed) ? parsed : 0;
        }

        private static string Bool(bool value) { return value ? "true" : "false"; }

        private static string JsonEscape(string value)
        {
            return value.Replace("\\", "\\\\").Replace("\"", "\\\"")
                .Replace("\r", "\\r").Replace("\n", "\\n");
        }
    }
}
