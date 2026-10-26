import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SwUpdate, type VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';

import { SwUpdateService } from '../sw-update.service';

const versionReady: VersionEvent = {
  type: 'VERSION_READY',
  currentVersion: { hash: 'old-hash' },
  latestVersion: { hash: 'new-hash' },
};

describe('SwUpdateService', () => {
  let versionUpdates: Subject<VersionEvent>;
  let snackBarActions: Subject<void>;
  let snackBarOpen: jest.Mock;
  let service: SwUpdateService;

  beforeEach(() => {
    versionUpdates = new Subject<VersionEvent>();
    snackBarActions = new Subject<void>();
    snackBarOpen = jest.fn(() => ({ onAction: () => snackBarActions.asObservable() }));

    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    TestBed.configureTestingModule({
      providers: [
        {
          provide: SwUpdate,
          useValue: {
            isEnabled: true,
            versionUpdates: versionUpdates.asObservable(),
            checkForUpdate: jest.fn().mockResolvedValue(false),
            activateUpdate: jest.fn().mockResolvedValue(true),
          },
        },
        { provide: MatSnackBar, useValue: { open: snackBarOpen } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    service = TestBed.inject(SwUpdateService);
    service.initializeUpdateCheck();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('opens a persistent snackbar offering a reload when a new version is ready', () => {
    versionUpdates.next(versionReady);

    expect(snackBarOpen).toHaveBeenCalledTimes(1);
    expect(snackBarOpen).toHaveBeenCalledWith(
      "Une nouvelle version de l'application est disponible.",
      'Recharger',
      { duration: 0 }
    );
  });

  it('ignores service worker events other than VERSION_READY', () => {
    versionUpdates.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'same-hash' } });

    expect(snackBarOpen).not.toHaveBeenCalled();
  });

  it('activates the update when the user clicks the snackbar action', () => {
    const activateUpdate = jest.spyOn(service, 'activateUpdate').mockResolvedValue();
    versionUpdates.next(versionReady);

    snackBarActions.next();

    expect(activateUpdate).toHaveBeenCalledTimes(1);
  });

  it('stops listening to version updates once destroyed', () => {
    TestBed.resetTestingModule();

    versionUpdates.next(versionReady);

    expect(snackBarOpen).not.toHaveBeenCalled();
    expect(versionUpdates.observed).toBe(false);
  });
});
