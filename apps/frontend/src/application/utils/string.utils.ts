export class StringUtils {
  static capitalizeFirstLetter(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  static buildRoute(...segments: string[]): string {
    const filteredSegments = segments.flatMap((path) =>
      path.split('/').filter((segment) => segment.length > 0)
    );

    return '/' + filteredSegments.map((s) => s.replace(/^\/+|\/+$/g, '')).join('/');
  }
}
