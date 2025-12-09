import { Component, EventEmitter, Input, Output } from '@angular/core';
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
})
export class SearchBarComponent {
  @Input() placeholder = 'Rechercher...';
  @Input() value = '';
  @Input() type: 'search' | 'text' = 'search';
  @Input() showSubmitButton = false;

  @Output() readonly queryChange = new EventEmitter<string>();
  @Output() readonly searchSubmit = new EventEmitter<string>();

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value ?? '';
    this.value = val;
    this.queryChange.emit(val);
  }

  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.searchSubmit.emit(this.value);
    }
  }

  clear() {
    this.value = '';
    this.queryChange.emit('');
  }
}
