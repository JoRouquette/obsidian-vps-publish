import type { ProgressPort } from '@core-domain/ports/progress-port';
import { Notice } from 'obsidian';

export class NoticeProgressAdapter implements ProgressPort {
  constructor(private readonly label = 'Publishing') {}

  private notice: Notice | null = null;
  private total = 0;
  private current = 0;
  private lastPct = -1;

  start(total: number): void {
    this.total = Math.max(0, total);
    this.current = 0;
    // Notice persistante (0 = pas de timeout)
    this.notice = new Notice(this.format(), 0);
    this.update();
  }

  advance(step = 1): void {
    this.current = Math.min(this.total, this.current + step);
    this.update();
  }

  finish(): void {
    // Ferme la notice persistante si possible
    const closableNotice = this.notice as (Notice & { hide?: () => void }) | null;
    closableNotice?.hide?.();
    this.notice = null;

    const completed = this.total === 0 || this.current >= this.total;
    new Notice(completed ? `${this.label} completed` : `${this.label} ended prematurely`);
  }

  // ---- internes ----
  private format(): string {
    const pct = this.total === 0 ? 100 : Math.floor((this.current / this.total) * 100);
    return `${this.label} ${this.current}/${this.total} (${pct}%)`;
  }

  private update(): void {
    const pct = this.total === 0 ? 100 : Math.floor((this.current / this.total) * 100);
    if (pct === this.lastPct && this.current !== this.total) return;
    this.lastPct = pct;

    // Obsidian <=1.4 a setMessage ; on garde un fallback si absent
    const msg = this.format();
    const noticeWithSetter = this.notice as
      | (Notice & { setMessage?: (message: string) => void })
      | null;
    if (noticeWithSetter && typeof noticeWithSetter.setMessage === 'function') {
      noticeWithSetter.setMessage(msg);
    } else {
      new Notice(msg, 1500);
    }
  }
}
