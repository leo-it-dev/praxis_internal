import { TestBed } from '@angular/core/testing';

import { LoadingoverlayService } from './loadingoverlay.service';

describe('LoadingoverlayService', () => {
  let service: LoadingoverlayService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoadingoverlayService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
