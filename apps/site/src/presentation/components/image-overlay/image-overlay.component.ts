import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  signal,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  standalone: true,
  selector: 'app-image-overlay',
  templateUrl: './image-overlay.component.html',
  styleUrls: ['./image-overlay.component.scss'],
  imports: [MatIconModule, MatButtonModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageOverlayComponent {
  @ViewChild('imageEl', { static: false }) imageEl?: ElementRef<HTMLImageElement>;

  isOpen = signal(false);
  imageSrc = signal('');
  imageAlt = signal('');
  scale = signal(1);
  translateX = signal(0);
  translateY = signal(0);

  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private lastTranslateX = 0;
  private lastTranslateY = 0;

  open(src: string, alt: string = '') {
    this.imageSrc.set(src);
    this.imageAlt.set(alt);
    this.isOpen.set(true);
    this.resetTransform();
  }

  close() {
    this.isOpen.set(false);
    this.resetTransform();
  }

  zoomIn() {
    const newScale = Math.min(this.scale() + 0.25, 5);
    this.scale.set(newScale);
  }

  zoomOut() {
    const newScale = Math.max(this.scale() - 0.25, 0.5);
    this.scale.set(newScale);
  }

  resetZoom() {
    this.resetTransform();
  }

  private resetTransform() {
    this.scale.set(1);
    this.translateX.set(0);
    this.translateY.set(0);
    this.lastTranslateX = 0;
    this.lastTranslateY = 0;
  }

  @HostListener('window:keydown.escape')
  onEscape() {
    if (this.isOpen()) {
      this.close();
    }
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      this.close();
    }
  }

  onMouseDown(event: MouseEvent) {
    if (this.scale() <= 1) return;
    event.preventDefault();
    this.isDragging = true;
    this.startX = event.clientX - this.translateX();
    this.startY = event.clientY - this.translateY();
  }

  @HostListener('window:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.isDragging) return;
    event.preventDefault();
    const newX = event.clientX - this.startX;
    const newY = event.clientY - this.startY;
    this.translateX.set(newX);
    this.translateY.set(newY);
  }

  @HostListener('window:mouseup')
  onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.lastTranslateX = this.translateX();
      this.lastTranslateY = this.translateY();
    }
  }

  onWheel(event: WheelEvent) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const newScale = Math.max(0.5, Math.min(5, this.scale() + delta));
    this.scale.set(newScale);
  }

  // Touch support for mobile
  private touchStartDistance = 0;
  private touchStartScale = 1;

  onTouchStart(event: TouchEvent) {
    if (event.touches.length === 2) {
      // Pinch zoom
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      this.touchStartDistance = this.getDistance(touch1, touch2);
      this.touchStartScale = this.scale();
    } else if (event.touches.length === 1 && this.scale() > 1) {
      // Pan
      const touch = event.touches[0];
      this.isDragging = true;
      this.startX = touch.clientX - this.translateX();
      this.startY = touch.clientY - this.translateY();
    }
  }

  onTouchMove(event: TouchEvent) {
    if (event.touches.length === 2) {
      // Pinch zoom
      event.preventDefault();
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      const distance = this.getDistance(touch1, touch2);
      const scale = (distance / this.touchStartDistance) * this.touchStartScale;
      this.scale.set(Math.max(0.5, Math.min(5, scale)));
    } else if (event.touches.length === 1 && this.isDragging) {
      // Pan
      event.preventDefault();
      const touch = event.touches[0];
      this.translateX.set(touch.clientX - this.startX);
      this.translateY.set(touch.clientY - this.startY);
    }
  }

  @HostListener('window:touchend')
  onTouchEnd() {
    this.isDragging = false;
    this.lastTranslateX = this.translateX();
    this.lastTranslateY = this.translateY();
  }

  private getDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
