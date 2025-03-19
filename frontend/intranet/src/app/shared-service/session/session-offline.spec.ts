import { TestBed } from '@angular/core/testing';

import { SessionOfflineService } from './session-offline.service';

describe('SessionOfflineService', () => {
  let service: SessionOfflineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SessionOfflineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
