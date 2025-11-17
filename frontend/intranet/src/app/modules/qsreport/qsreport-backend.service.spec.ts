import { TestBed } from '@angular/core/testing';

import { QsreportBackendService } from './qsreport-backend.service';

describe('QsreportBackendService', () => {
  let service: QsreportBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(QsreportBackendService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
