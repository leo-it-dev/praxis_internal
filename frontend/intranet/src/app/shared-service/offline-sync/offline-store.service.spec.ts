import { TestBed } from '@angular/core/testing';

import { OfflineStoreService } from './offline-store.service';

describe('OfflineStoreService', () => {
  let service: OfflineStoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OfflineStoreService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
