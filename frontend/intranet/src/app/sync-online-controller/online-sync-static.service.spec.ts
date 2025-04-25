import { TestBed } from '@angular/core/testing';

import { OnlineSyncStaticService } from './online-sync-static.service';

describe('OnlineSyncStaticService', () => {
  let service: OnlineSyncStaticService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(OnlineSyncStaticService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
