using System;
using System.Collections.Generic;
using System.Drawing;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Forms;

namespace CodexBilingualOverlay
{
    public sealed class ControlWindow : Form
    {
        private const int SwShow = 5;

        [DllImport("user32.dll")]
        private static extern bool ShowWindow(IntPtr window, int command);

        [DllImport("user32.dll")]
        private static extern bool IsWindowVisible(IntPtr window);

        private readonly Dictionary<string, Button> buttons = new Dictionary<string, Button>();
        private readonly Panel modes = new Panel();
        private readonly Label status = new Label();
        private string currentMode;

        public static void Run()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            using (ControlWindow window = new ControlWindow())
            {
                Application.Run(window);
            }
        }

        private ControlWindow()
        {
            Text = "中英双语增强器控制卡";
            Font = SystemFonts.MessageBoxFont;
            AutoScaleMode = AutoScaleMode.Dpi;
            ClientSize = new Size(400, 112);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            StartPosition = FormStartPosition.CenterScreen;
            MinimizeBox = true;
            MaximizeBox = false;

            modes.SetBounds(12, 12, 376, 40);
            modes.AccessibleName = "翻译模式";
            modes.Enabled = false;
            Controls.Add(modes);
            AddMode("off", "关闭", 0);
            AddMode("hover", "悬停翻译", 128);
            AddMode("preload", "页面预翻译", 256);

            status.SetBounds(12, 62, 376, 42);
            status.AutoEllipsis = true;
            status.Text = "正在读取当前模式…";
            Controls.Add(status);

            Shown += delegate
            {
                // The PowerShell launcher is hidden, which can hide the first WinForms window too.
                Reveal();
                Thread reader = new Thread(ReadCommands);
                reader.IsBackground = true;
                reader.Start();
                Console.WriteLine("READY");
            };
        }

        private void AddMode(string mode, string label, int left)
        {
            Button button = new Button();
            button.TextAlign = ContentAlignment.MiddleCenter;
            button.Text = label;
            button.SetBounds(left, 0, 120, 38);
            button.Click += delegate
            {
                if (mode == currentMode) return;
                modes.Enabled = false;
                status.Text = "正在切换…";
                Console.WriteLine("MODE|" + mode);
            };
            buttons.Add(mode, button);
            modes.Controls.Add(button);
        }

        private void ReadCommands()
        {
            string line;
            while ((line = Console.ReadLine()) != null)
            {
                string[] parts = line.Split(new[] { '|' }, 2);
                if (parts.Length != 2) continue;
                try
                {
                    BeginInvoke((Action)(() => HandleCommand(parts[0], parts[1])));
                }
                catch (InvalidOperationException) { return; }
            }
            try { BeginInvoke((Action)Close); } catch (InvalidOperationException) {}
        }

        private void HandleCommand(string command, string value)
        {
            if (command == "ERROR")
            {
                RenderMode(currentMode);
                status.Text = "切换失败：" + Encoding.UTF8.GetString(Convert.FromBase64String(value));
                return;
            }
            if (command != "SHOW" && command != "MODE") return;
            RenderMode(value);
            if (command == "SHOW") Reveal();
        }

        private void Reveal()
        {
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
            ShowWindow(Handle, SwShow);
            if (!IsWindowVisible(Handle))
                throw new InvalidOperationException("Windows control window is not visible");
            Activate();
        }

        private void RenderMode(string mode)
        {
            currentMode = mode;
            foreach (KeyValuePair<string, Button> option in buttons)
            {
                bool selected = option.Key == mode;
                option.Value.UseVisualStyleBackColor = !selected;
                option.Value.BackColor = selected ? SystemColors.Highlight : SystemColors.Control;
                option.Value.ForeColor = selected ? SystemColors.HighlightText : SystemColors.ControlText;
            }
            modes.Enabled = true;
            status.Text = "当前：" + buttons[mode].Text;
        }
    }
}
