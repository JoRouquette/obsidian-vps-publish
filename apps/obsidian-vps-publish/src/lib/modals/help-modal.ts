import { type App, Modal } from 'obsidian';

import type { Translations } from '../../i18n';

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

    // Sections
    this.renderSection(contentEl, this.t.help.sections.publishing);
    this.renderSection(contentEl, this.t.help.sections.noPublishing);
    this.renderSection(contentEl, this.t.help.sections.frontmatter);
    this.renderSection(contentEl, this.t.help.sections.wikilinks);
    this.renderSection(contentEl, this.t.help.sections.assets);
    this.renderSection(contentEl, this.t.help.sections.dataview);
    this.renderSection(contentEl, this.t.help.sections.leaflet);

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

  private renderSection(
    container: HTMLElement,
    section: {
      title: string;
      content: string;
      examples?: Array<{ code: string; description: string }>;
    }
  ) {
    const sectionDiv = container.createDiv({ cls: 'help-section' });

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
