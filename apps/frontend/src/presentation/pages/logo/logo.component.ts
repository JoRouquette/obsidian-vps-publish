import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

@Component({
  standalone: true,
  selector: 'app-logo',
  imports: [RouterLink],
  templateUrl: './logo.component.html',
  styleUrls: ['./logo.component.scss'],
})
export class LogoComponent {
  constructor(private readonly theme: ThemeService) {}

  readonly src = computed(() =>
    this.theme.isDark()
      ? 'assets/logo/heptacle-origine-light-256.png'
      : 'assets/logo/heptacle-origine-dark-256.png'
  );
}
