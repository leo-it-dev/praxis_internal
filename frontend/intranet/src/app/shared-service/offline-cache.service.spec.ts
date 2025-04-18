import { TestBed } from '@angular/core/testing';

import { OfflineCacheService } from './offline-cache.service';

describe('OfflineCacheService', () => {
  let service: OfflineCacheService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OfflineCacheService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
