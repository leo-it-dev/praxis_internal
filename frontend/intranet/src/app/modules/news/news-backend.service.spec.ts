import { TestBed } from '@angular/core/testing';

import { NewsBackendService } from './news-backend.service';

describe('NewsBackendService', () => {
  let service: NewsBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NewsBackendService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
