import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BlockingoverlayComponent } from './blockingoverlay.component';

describe('BlockingoverlayComponent', () => {
  let component: BlockingoverlayComponent;
  let fixture: ComponentFixture<BlockingoverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BlockingoverlayComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BlockingoverlayComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
