import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  ViewChild,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  standalone: true,
  selector: 'app-search-bar',
  imports: [MatFormFieldModule, MatIconModule, MatInputModule, MatButtonModule],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBarComponent {
  private static _idSeq = 0;

  @Input() placeholder = 'Rechercher...';
  @Input() type: 'search' | 'text' = 'search';
  @Input() showSubmitButton = false;

  /** Controlled value from parent — synced into the internal signal for OnPush compat. */
  @Input() set value(v: string) {
    this._query.set(v ?? '');
  }

  readonly disabled = input(false);
  readonly loading = input(false);
  readonly errorMessage = input<string | null>(null);

  readonly queryChange = output<string>();
  readonly searchSubmit = output<string>();

  /** Stable ID linking the error paragraph to the input via aria-describedby. */
  protected readonly errorId = `search-bar-error-${++SearchBarComponent._idSeq}`;

  /** Writable signal for the current query — updated both by parent and by user input. */
  protected readonly _query = signal('');

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  onInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value ?? '';
    this._query.set(val);
    this.queryChange.emit(val);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.searchSubmit.emit(this._query());
    }
  }

  clear(): void {
    this._query.set('');
    this.queryChange.emit('');
    this.searchInput?.nativeElement.focus();
  }
}
