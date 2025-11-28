import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';

@Component({
  standalone: true,
  selector: 'app-search-bar',
  imports: [MatFormFieldModule, MatIconModule, MatInputModule],
  templateUrl: './search-bar.component.html',
  styleUrls: ['./search-bar.component.scss'],
})
export class SearchBarComponent {
  @Input() placeholder = 'Rechercher...';
  @Input() value = '';
  @Input() type: 'search' | 'text' = 'search';

  @Output() readonly queryChange = new EventEmitter<string>();

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value ?? '';
    this.value = val;
    this.queryChange.emit(val);
  }

  clear() {
    this.value = '';
    this.queryChange.emit('');
  }
}
