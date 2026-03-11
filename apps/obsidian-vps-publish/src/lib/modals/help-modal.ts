import { type App, Modal } from 'obsidian';

import type { Translations } from '../../i18n';

type HelpSection = {
  title: string;
  content: string;
  examples?: Array<{ code: string; description: string }>;
};

export class HelpModal extends Modal {
  private readonly t: Translations;

  constructor(app: App, t: Translations) {
    super(app);
    this.t = t;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('vps-publish-help-modal');

    // Modal title
    contentEl.createEl('h2', { text: this.t.help.title });

    // Introduction
    const intro = contentEl.createDiv({ cls: 'help-section' });
    intro.createEl('p', { text: this.t.help.introduction });

    // Build sections array for TOC and rendering
    const sections: Array<{ id: string; section: HelpSection }> = [
      { id: 'publishing', section: this.t.help.sections.publishing },
      { id: 'noPublishing', section: this.t.help.sections.noPublishing },
      { id: 'frontmatter', section: this.t.help.sections.frontmatter },
      { id: 'wikilinks', section: this.t.help.sections.wikilinks },
      { id: 'assets', section: this.t.help.sections.assets },
      { id: 'dataview', section: this.t.help.sections.dataview },
      { id: 'leaflet', section: this.t.help.sections.leaflet },
      { id: 'markdown', section: this.t.help.sections.markdown },
    ];

    // Quick navigation (TOC)
    const toc = contentEl.createDiv({ cls: 'help-toc' });
    toc.createEl('span', { text: this.t.help.tocLabel ?? 'Jump to: ', cls: 'help-toc-label' });
    sections.forEach(({ id, section }, i) => {
      const link = toc.createEl('a', {
        text: section.title,
        cls: 'help-toc-link',
        href: `#help-section-${id}`,
      });
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = contentEl.querySelector(`#help-section-${id}`);
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      if (i < sections.length - 1) {
        toc.createSpan({ text: ' • ', cls: 'help-toc-sep' });
      }
    });

    // Render sections with IDs for anchor navigation
    sections.forEach(({ id, section }) => {
      this.renderSection(contentEl, section, id);
    });

    // Footer with links
    const footer = contentEl.createDiv({ cls: 'help-footer' });
    footer.createEl('p', { text: this.t.help.footer.docsText });

    if (this.t.help.footer.docsLink) {
      const link = footer.createEl('a', {
        text: this.t.help.footer.docsLinkText,
        href: this.t.help.footer.docsLink,
      });
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener noreferrer');
    }

    // Close button
    const buttonContainer = contentEl.createDiv({ cls: 'modal-button-container' });
    const closeButton = buttonContainer.createEl('button', {
      text: this.t.help.closeButton,
      cls: 'mod-cta',
    });
    closeButton.addEventListener('click', () => this.close());
  }

  private renderSection(container: HTMLElement, section: HelpSection, id: string) {
    const sectionDiv = container.createDiv({ cls: 'help-section' });
    sectionDiv.id = `help-section-${id}`;

    // Title
    sectionDiv.createEl('h3', { text: section.title });

    // Content - support multiple paragraphs
    const paragraphs = section.content.split('\n\n');
    paragraphs.forEach((p) => {
      if (p.trim()) {
        sectionDiv.createEl('p', { text: p.trim() });
      }
    });

    // Examples
    if (section.examples && section.examples.length > 0) {
      const examplesDiv = sectionDiv.createDiv({ cls: 'help-examples' });

      section.examples.forEach((example) => {
        const exampleDiv = examplesDiv.createDiv({ cls: 'help-example' });

        // Code block
        const codeBlock = exampleDiv.createEl('pre');
        const code = codeBlock.createEl('code', { text: example.code });
        code.addClass('language-markdown');

        // Description
        if (example.description) {
          exampleDiv.createEl('p', {
            text: example.description,
            cls: 'help-example-description',
          });
        }
      });
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
