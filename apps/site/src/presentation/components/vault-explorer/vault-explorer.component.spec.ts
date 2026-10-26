import { Component, Input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { TreeNode } from '@core-application/catalog/queries/build-tree.query';
import { defaultTreeNode } from '@core-application/catalog/queries/build-tree.query';

import { CatalogFacade } from '../../../application/facades/catalog-facade';
import { SearchBarComponent } from '../search-bar/search-bar.component';
import { VaultExplorerComponent } from './vault-explorer.component';

jest.mock('../../../application/facades/catalog-facade', () => ({
  CatalogFacade: class MockCatalogFacade {},
}));

@Component({ selector: 'app-search-bar', standalone: true, template: '' })
class StubSearchBarComponent {
  @Input() placeholder = '';
  @Input() value = '';
}

function treeWithFiles(...names: string[]): TreeNode {
  return {
    ...defaultTreeNode,
    count: names.length,
    children: names.map((name) => ({
      kind: 'file',
      name,
      label: name,
      path: name,
      count: 0,
    })),
  };
}

describe('VaultExplorerComponent rendering under OnPush', () => {
  let measuredWidth: number;

  beforeEach(() => {
    measuredWidth = 0;
    // jsdom performs no layout: scrollWidth is always 0 unless stubbed.
    jest.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(() => measuredWidth);

    TestBed.configureTestingModule({
      imports: [VaultExplorerComponent],
      providers: [
        provideRouter([]),
        {
          provide: CatalogFacade,
          useValue: { manifest: signal(null), ensureManifest: () => Promise.resolve() },
        },
      ],
    }).overrideComponent(VaultExplorerComponent, {
      remove: { imports: [SearchBarComponent] },
      add: { imports: [StubSearchBarComponent] },
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('refreshes the phantom scrollbar width when the root nodes change', async () => {
    const fixture = TestBed.createComponent(VaultExplorerComponent);
    fixture.detectChanges();
    await fixture.whenStable();

    const phantomWidth = (): string =>
      (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.phantom')?.style.width ??
      '';

    measuredWidth = 320;
    fixture.componentInstance.tree.set(treeWithFiles('alpha'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(phantomWidth()).toBe('320px');

    measuredWidth = 480;
    fixture.componentInstance.tree.set(treeWithFiles('alpha', 'beta'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(phantomWidth()).toBe('480px');
  });
});
