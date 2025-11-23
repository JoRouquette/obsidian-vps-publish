import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

type Crumb = { label: string; url: string };

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [RouterLink, MatToolbarModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
})
export class TopbarComponent {
  @Input() siteName = '';
  @Input() crumbs: Crumb[] = [];
  @Input() isDark = false;

  @Output() toggleTheme = new EventEmitter<void>();
  @Output() crumbClicked = new EventEmitter<Crumb>();
}
