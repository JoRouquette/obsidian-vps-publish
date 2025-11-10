import { Component, Input } from '@angular/core';

type Crumb = { label: string; url: string };

@Component({
  selector: 'app-topbar',
  standalone: true,
  templateUrl: './topbar.component.html',
  styleUrls: ['./topbar.component.scss'],
})
export class TopbarComponent {
  @Input() siteName: string = '';
  @Input() crumbs: Crumb[] = [];
}
